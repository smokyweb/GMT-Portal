// Explicit isolated-stage migration. Not imported or run by production startup.
export async function migrateGanPackages(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gan_attachment_sources (
      id UUID PRIMARY KEY,nofo_id UUID NOT NULL REFERENCES nofos(id),kind TEXT NOT NULL CHECK(kind IN ('special_conditions','direct_deposit')),
      title TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),pages INTEGER NOT NULL CHECK(pages BETWEEN 1 AND 150),
      signature_pages JSONB NOT NULL,pdf BYTEA NOT NULL,pdf_sha256 TEXT NOT NULL,byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 20 AND 10485760),
      actor_id TEXT NOT NULL,request_id UUID NOT NULL,request_sha256 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(nofo_id,kind,version),UNIQUE(nofo_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS gan_package_snapshots (
      id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),application_id TEXT NOT NULL,organization_id TEXT NOT NULL,
      gan_revision INTEGER NOT NULL CHECK(gan_revision>0),package_revision INTEGER NOT NULL CHECK(package_revision>0),
      manifest JSONB NOT NULL,manifest_sha256 TEXT NOT NULL,pdf BYTEA NOT NULL,pdf_sha256 TEXT NOT NULL,
      actor_id TEXT NOT NULL,request_id UUID NOT NULL,request_sha256 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(document_id,package_revision),UNIQUE(document_id,request_id),
      FOREIGN KEY(document_id,gan_revision) REFERENCES gan_document_snapshots(document_id,revision)
    );
    CREATE OR REPLACE FUNCTION guard_gan_attachment_source() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP<>'INSERT' OR current_setting('gmt.gan_package_action',true) IS DISTINCT FROM 'attachment' THEN RAISE EXCEPTION 'GAN attachment versions are immutable; use the owned upload workflow' USING ERRCODE='42501'; END IF;
      IF NEW.pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.pdf),'hex') OR NEW.byte_size<>octet_length(NEW.pdf) OR jsonb_typeof(NEW.signature_pages)<>'array' OR
        (NEW.kind='special_conditions' AND jsonb_array_length(NEW.signature_pages)=0) THEN RAISE EXCEPTION 'Attachment metadata does not match its PDF' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_attachment_source ON gan_attachment_sources;
    CREATE TRIGGER protect_gan_attachment_source BEFORE INSERT OR UPDATE OR DELETE ON gan_attachment_sources FOR EACH ROW EXECUTE FUNCTION guard_gan_attachment_source();
    CREATE OR REPLACE FUNCTION guard_gan_package_snapshot() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP<>'INSERT' OR current_setting('gmt.gan_package_action',true) IS DISTINCT FROM 'package' THEN RAISE EXCEPTION 'GAN package snapshots are immutable; use the owned package workflow' USING ERRCODE='42501'; END IF;
      IF NEW.pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.pdf),'hex') OR NEW.manifest_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.manifest::text,'UTF8')),'hex') OR
        NEW.manifest->>'document_id' IS DISTINCT FROM NEW.document_id::text OR (NEW.manifest->>'gan_revision')::integer IS DISTINCT FROM NEW.gan_revision OR
        NEW.manifest->>'application_id' IS DISTINCT FROM NEW.application_id OR NEW.manifest->>'organization_id' IS DISTINCT FROM NEW.organization_id OR
        NEW.manifest->>'pdf_sha256' IS DISTINCT FROM NEW.pdf_sha256 OR NEW.manifest->>'kind' IS DISTINCT FROM 'draft_package' OR NEW.manifest->>'ready_for_sending' IS DISTINCT FROM 'false' THEN
        RAISE EXCEPTION 'Package metadata does not match its PDF or recipient' USING ERRCODE='23514';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM gan_document_snapshots s WHERE s.document_id=NEW.document_id AND s.revision=NEW.gan_revision AND s.pdf_sha256=NEW.manifest->>'gan_pdf_sha256'
        AND s.application_id=NEW.application_id AND s.snapshot->'sources'->>'organizationId'=NEW.organization_id) THEN RAISE EXCEPTION 'Package must match its immutable GAN revision' USING ERRCODE='23514'; END IF;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.manifest->'parts') p JOIN gan_attachment_sources a ON a.id::text=p->>'source_id'
        WHERE a.kind='special_conditions' AND p->>'kind'=a.kind AND a.pdf_sha256=p->>'pdf_sha256' AND a.nofo_id::text=NEW.manifest->>'nofo_id') THEN RAISE EXCEPTION 'Package requires its saved Special Conditions' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS protect_gan_package_snapshot ON gan_package_snapshots;
    CREATE TRIGGER protect_gan_package_snapshot BEFORE INSERT OR UPDATE OR DELETE ON gan_package_snapshots FOR EACH ROW EXECUTE FUNCTION guard_gan_package_snapshot();
  `);
}
