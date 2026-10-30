// Explicit staging migration only; never called from server startup.
export async function migrateGanBatches(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gan_draft_batches (
      id UUID PRIMARY KEY,actor_id TEXT NOT NULL,nofo_id TEXT NOT NULL,request_sha256 TEXT NOT NULL,
      template_id TEXT NOT NULL,template_version INTEGER NOT NULL CHECK(template_version>0),template_sha256 TEXT NOT NULL,
      nofo_revision INTEGER,grantee_settings_revision INTEGER,selection JSONB NOT NULL,rows JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(jsonb_typeof(selection)='object'),CHECK(jsonb_typeof(rows)='array'),CHECK(jsonb_array_length(rows)<=5000)
    );
    ALTER TABLE gan_draft_batches ADD COLUMN IF NOT EXISTS grantee_settings_revision INTEGER;
    CREATE TABLE IF NOT EXISTS gan_draft_batch_results (
      batch_id UUID NOT NULL REFERENCES gan_draft_batches(id),application_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('Generated','Blocked','Failed')),document_id UUID,revision INTEGER,pdf_sha256 TEXT,
      replayed BOOLEAN NOT NULL DEFAULT false,award_amount TEXT,project_count INTEGER,reason TEXT,details JSONB NOT NULL DEFAULT '[]',attempts INTEGER NOT NULL CHECK(attempts>0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(batch_id,application_id)
    );
    ALTER TABLE gan_draft_batch_results ADD COLUMN IF NOT EXISTS award_amount TEXT;
    ALTER TABLE gan_draft_batch_results ADD COLUMN IF NOT EXISTS project_count INTEGER;
    CREATE TABLE IF NOT EXISTS gan_draft_batch_retry_passes (
      id UUID PRIMARY KEY,batch_id UUID NOT NULL REFERENCES gan_draft_batches(id),actor_id TEXT NOT NULL,rows JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(jsonb_typeof(rows)='array')
    );
    CREATE OR REPLACE FUNCTION guard_gan_batch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'batch-plan' THEN
        RAISE EXCEPTION 'GAN batch selections are immutable' USING ERRCODE='42501';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_batch ON gan_draft_batches;
    CREATE TRIGGER protect_gan_batch BEFORE INSERT OR UPDATE OR DELETE ON gan_draft_batches FOR EACH ROW EXECUTE FUNCTION guard_gan_batch();
    DROP TRIGGER IF EXISTS protect_gan_retry_pass ON gan_draft_batch_retry_passes;
    CREATE TRIGGER protect_gan_retry_pass BEFORE INSERT OR UPDATE OR DELETE ON gan_draft_batch_retry_passes FOR EACH ROW EXECUTE FUNCTION guard_gan_batch();
    CREATE OR REPLACE FUNCTION guard_gan_batch_result() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'batch-result' THEN
        RAISE EXCEPTION 'Use the owned GAN batch runner' USING ERRCODE='42501';
      END IF;
      IF TG_OP='UPDATE' AND (NEW.batch_id<>OLD.batch_id OR NEW.application_id<>OLD.application_id OR NEW.attempts<>OLD.attempts+1) THEN
        RAISE EXCEPTION 'Invalid GAN batch retry metadata' USING ERRCODE='23514';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM gan_draft_batches b CROSS JOIN jsonb_array_elements(b.rows) r WHERE b.id=NEW.batch_id AND r->>'applicationId'=NEW.application_id) THEN
        RAISE EXCEPTION 'Application is outside this GAN batch' USING ERRCODE='23514';
      END IF;
      IF NEW.state='Generated' AND NOT EXISTS(SELECT 1 FROM gan_draft_batches b JOIN gan_document_snapshots s ON s.request_id=(SELECT r->>'requestId' FROM jsonb_array_elements(b.rows) r WHERE r->>'applicationId'=NEW.application_id)::uuid
        WHERE b.id=NEW.batch_id AND s.application_id=NEW.application_id AND s.document_id=NEW.document_id AND s.revision=NEW.revision AND s.pdf_sha256=NEW.pdf_sha256 AND NEW.award_amount=s.snapshot->'values'->>'total_award_amount' AND NEW.project_count=jsonb_array_length(s.snapshot->'projects')) THEN
        RAISE EXCEPTION 'The batch result must reference its saved GAN snapshot' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_batch_result ON gan_draft_batch_results;
    CREATE TRIGGER protect_gan_batch_result BEFORE INSERT OR UPDATE OR DELETE ON gan_draft_batch_results FOR EACH ROW EXECUTE FUNCTION guard_gan_batch_result();
  `);
}
