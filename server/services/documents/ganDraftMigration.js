// Explicit staging migration only. Nothing imports this from server startup.
export async function migrateGanDrafts(db) {
  await db.query(`
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_managed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_snapshot JSONB;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_pdf BYTEA;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_pdf_sha256 TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_body_sha256 TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_template_sha256 TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_template_version INTEGER;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_authorized_official_id TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_grantee_id TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_generated_by TEXT;
    ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS gan_generated_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS generated_documents_one_gan ON generated_documents(application_id) WHERE gan_managed;
    CREATE TABLE IF NOT EXISTS gan_document_snapshots (
      id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),application_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>0),request_id UUID NOT NULL,request_sha256 TEXT NOT NULL,
      snapshot JSONB NOT NULL,pdf BYTEA NOT NULL,pdf_sha256 TEXT NOT NULL,body_sha256 TEXT NOT NULL,template_sha256 TEXT NOT NULL,
      actor_id TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(document_id,revision),UNIQUE(application_id,request_id)
    );
    DO $$
    DECLARE cname TEXT;
    BEGIN
      FOR cname IN SELECT c.conname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname='status'
        WHERE c.conrelid='generated_documents'::regclass AND c.contype='c' AND c.conkey=ARRAY[a.attnum]::smallint[]
      LOOP EXECUTE format('ALTER TABLE generated_documents DROP CONSTRAINT %I',cname); END LOOP;
      ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_status_check CHECK(status IN ('Draft','Sent','Reviewed','Signed','Rejected'));
    END $$;
    CREATE OR REPLACE FUNCTION guard_gan_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN
        IF OLD.gan_managed THEN RAISE EXCEPTION 'Managed GANs cannot be deleted' USING ERRCODE='42501'; END IF;
        RETURN OLD;
      END IF;
      IF TG_OP='UPDATE' AND OLD.gan_managed AND NOT NEW.gan_managed THEN RAISE EXCEPTION 'GAN ownership cannot be removed' USING ERRCODE='42501'; END IF;
      IF TG_OP='UPDATE' AND OLD.gan_managed AND current_setting('gmt.gan_action',true)='workflow' THEN
        IF to_regprocedure(format('%I.verify_gan_document_transition(jsonb,jsonb)',current_schema())) IS NULL THEN
          RAISE EXCEPTION 'The owned GAN workflow is not enabled' USING ERRCODE='42501';
        END IF;
        EXECUTE format('SELECT %I.verify_gan_document_transition($1,$2)',current_schema()) USING to_jsonb(OLD),to_jsonb(NEW);
        RETURN NEW;
      END IF;
      IF NEW.gan_managed THEN
        IF current_setting('gmt.gan_action',true) IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Use the owned GAN draft workflow' USING ERRCODE='42501'; END IF;
        IF TG_OP='UPDATE' AND (OLD.status NOT IN ('Draft','Rejected') OR NEW.gan_revision<>OLD.gan_revision+1 OR NEW.application_id IS DISTINCT FROM OLD.application_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
          RAISE EXCEPTION 'This GAN snapshot cannot be replaced' USING ERRCODE='42501';
        END IF;
        IF NEW.status<>'Draft' OR NEW.doc_type<>'Grant Award Notice' OR NEW.gan_revision<1 THEN RAISE EXCEPTION 'Invalid GAN draft metadata' USING ERRCODE='23514'; END IF;
        IF NEW.gan_pdf IS NULL OR NEW.gan_snapshot IS NULL OR NEW.populated_body IS NULL OR NEW.gan_template_version IS NULL OR NEW.gan_template_version<1 OR NEW.gan_template_sha256 IS NULL OR NEW.gan_snapshot->>'template_body' IS NULL OR
          NEW.gan_snapshot->>'merged_body' IS DISTINCT FROM NEW.populated_body OR NEW.gan_snapshot->>'template_body_sha256' IS DISTINCT FROM NEW.gan_template_sha256 OR
          NEW.gan_generated_by IS NULL OR NEW.gan_authorized_official_id IS NULL OR NEW.gan_grantee_id IS NULL OR
          NEW.gan_snapshot->>'template_id' IS DISTINCT FROM NEW.template_id OR NEW.gan_snapshot->'sources'->>'authorizedOfficialId' IS DISTINCT FROM NEW.gan_authorized_official_id OR
          NEW.gan_snapshot->'sources'->>'granteeId' IS DISTINCT FROM NEW.gan_grantee_id OR NEW.gan_snapshot->'sources'->>'applicationId' IS DISTINCT FROM NEW.application_id OR NEW.gan_snapshot->'sources'->>'organizationId' IS DISTINCT FROM NEW.organization_id OR
          NEW.gan_pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.gan_pdf),'hex') OR
          NEW.gan_body_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.populated_body,'UTF8')),'hex') OR
          NEW.gan_template_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.gan_snapshot->>'template_body','UTF8')),'hex') OR
          NEW.gan_snapshot->>'pdf_sha256' IS DISTINCT FROM NEW.gan_pdf_sha256 OR
          NEW.gan_snapshot->>'merged_body_sha256' IS DISTINCT FROM NEW.gan_body_sha256 OR
          (NEW.gan_snapshot->>'template_version')::integer IS DISTINCT FROM NEW.gan_template_version THEN
          RAISE EXCEPTION 'GAN snapshot hashes or version do not match' USING ERRCODE='23514';
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_document ON generated_documents;
    CREATE TRIGGER protect_gan_document BEFORE INSERT OR UPDATE OR DELETE ON generated_documents FOR EACH ROW EXECUTE FUNCTION guard_gan_document();
    CREATE OR REPLACE FUNCTION guard_gan_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'GAN snapshot history is immutable' USING ERRCODE='42501'; END IF;
      IF NOT EXISTS(SELECT 1 FROM generated_documents d WHERE d.id=NEW.document_id AND d.gan_managed AND d.application_id=NEW.application_id
        AND d.gan_generated_by=NEW.actor_id AND d.gan_revision=NEW.revision AND d.gan_snapshot=NEW.snapshot AND d.gan_pdf=NEW.pdf AND d.gan_pdf_sha256=NEW.pdf_sha256
        AND d.gan_body_sha256=NEW.body_sha256 AND d.gan_template_sha256=NEW.template_sha256) THEN
        RAISE EXCEPTION 'GAN history must match its generated snapshot' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_snapshot ON gan_document_snapshots;
    CREATE TRIGGER protect_gan_snapshot BEFORE INSERT OR UPDATE OR DELETE ON gan_document_snapshots FOR EACH ROW EXECUTE FUNCTION guard_gan_snapshot();
  `);
}
