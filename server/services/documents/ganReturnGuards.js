export const ganReturnGuards=`
CREATE OR REPLACE FUNCTION guard_gan_return_upload() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE issue gan_workflow_issues%ROWTYPE; state gan_workflows%ROWTYPE; part JSONB; page JSONB;
BEGIN
 IF TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'return_upload' THEN RAISE EXCEPTION 'Signed originals are immutable; use the owned return workflow' USING ERRCODE='42501'; END IF;
 SELECT * INTO issue FROM gan_workflow_issues WHERE id=NEW.issue_id; SELECT * INTO state FROM gan_workflows WHERE document_id=NEW.document_id;
 IF issue.document_id IS DISTINCT FROM NEW.document_id OR state.issue_id IS DISTINCT FROM issue.id OR state.revision IS DISTINCT FROM NEW.workflow_revision OR state.phase NOT IN ('Reviewed','UploadReturned') OR
   issue.recipient_id IS DISTINCT FROM NEW.actor_id OR NOT issue.manifest->'allowed_methods' ? 'upload' OR
   NOT EXISTS(SELECT 1 FROM users WHERE id::text=NEW.actor_id AND role='user' AND organization_id=issue.organization_id AND (active_status IS NULL OR active_status='active')) THEN
  RAISE EXCEPTION 'Only the current assigned official may upload signed pages' USING ERRCODE='42501'; END IF;
 SELECT value INTO part FROM jsonb_array_elements(issue.manifest->'parts') WHERE value->>'kind'=NEW.kind;
 IF part IS NULL OR NEW.pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.pdf),'hex') OR NEW.byte_size<>octet_length(NEW.pdf) OR jsonb_typeof(NEW.source_pages)<>'array' OR jsonb_array_length(NEW.source_pages)<>NEW.pages THEN
  RAISE EXCEPTION 'Signed return metadata does not match the issued part and file' USING ERRCODE='23514'; END IF;
 FOR page IN SELECT value FROM jsonb_array_elements(NEW.source_pages) LOOP
  IF jsonb_typeof(page)<>'number' OR page::text !~ '^[1-9][0-9]*$' OR (page::text)::integer>(part->>'page_end')::integer-(part->>'page_start')::integer+1 THEN RAISE EXCEPTION 'Invalid original page mapping' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.source_pages))<>NEW.pages THEN RAISE EXCEPTION 'Original page mappings must be distinct' USING ERRCODE='23514'; END IF;
 IF NEW.version<>(SELECT COALESCE(MAX(version),0)+1 FROM gan_return_uploads WHERE issue_id=NEW.issue_id AND kind=NEW.kind) THEN RAISE EXCEPTION 'Invalid signed upload version' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_return_upload ON gan_return_uploads;
CREATE TRIGGER protect_gan_return_upload BEFORE INSERT OR UPDATE OR DELETE ON gan_return_uploads FOR EACH ROW EXECUTE FUNCTION guard_gan_return_upload();
CREATE OR REPLACE FUNCTION guard_gan_return_submission() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE issue gan_workflow_issues%ROWTYPE; state gan_workflows%ROWTYPE; part JSONB; entry JSONB; upload gan_return_uploads%ROWTYPE; page JSONB;
BEGIN
 IF TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'workflow' THEN RAISE EXCEPTION 'Signed submissions are immutable' USING ERRCODE='42501'; END IF;
 SELECT * INTO issue FROM gan_workflow_issues WHERE id=NEW.issue_id; SELECT * INTO state FROM gan_workflows WHERE document_id=NEW.document_id;
 IF issue.document_id IS DISTINCT FROM NEW.document_id OR state.issue_id IS DISTINCT FROM issue.id OR state.phase NOT IN ('Reviewed','UploadReturned') OR NEW.actor_id IS DISTINCT FROM issue.recipient_id OR
   NOT issue.manifest->'allowed_methods' ? 'upload' OR NEW.manifest->>'issue_id' IS DISTINCT FROM issue.id::text OR NEW.manifest->>'document_id' IS DISTINCT FROM NEW.document_id::text OR
   NEW.manifest->>'id' IS DISTINCT FROM NEW.id::text OR NEW.manifest->>'kind' IS DISTINCT FROM 'signed_upload_submission' OR
   NOT EXISTS(SELECT 1 FROM users WHERE id::text=NEW.actor_id AND email=NEW.manifest->'recipient'->>'email' AND role='user' AND organization_id=issue.organization_id AND (active_status IS NULL OR active_status='active')) OR
   lower(regexp_replace(trim(normalize(NEW.manifest->'recipient'->>'name',NFC)),'[[:space:]]+',' ','g')) IS DISTINCT FROM lower(regexp_replace(trim(normalize(issue.manifest->'recipient'->>'name',NFC)),'[[:space:]]+',' ','g')) OR
   COALESCE(length(trim(NEW.manifest->'recipient'->>'title')),0) NOT BETWEEN 1 AND 160 OR
   NEW.manifest->>'issued_pdf_sha256' IS DISTINCT FROM issue.pdf_sha256 OR NEW.manifest->>'pdf_sha256' IS DISTINCT FROM NEW.pdf_sha256 OR NEW.pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.pdf),'hex') OR
   NEW.manifest_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.manifest::text,'UTF8')),'hex') OR NEW.manifest->'recipient'->>'id' IS DISTINCT FROM NEW.actor_id OR
   (NEW.manifest->'recipient'->>'received_at')::timestamptz IS DISTINCT FROM NEW.created_at OR NEW.manifest->>'confirmed' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'Signed submission must match the current issued package and recipient' USING ERRCODE='23514'; END IF;
 IF NEW.submission_number<>(SELECT COALESCE(MAX(submission_number),0)+1 FROM gan_return_submissions WHERE issue_id=NEW.issue_id) OR
   jsonb_typeof(NEW.manifest->'uploads')<>'array' OR jsonb_array_length(NEW.manifest->'uploads') NOT BETWEEN 2 AND 3 OR
   (SELECT count(DISTINCT value->>'kind') FROM jsonb_array_elements(NEW.manifest->'uploads'))<>jsonb_array_length(NEW.manifest->'uploads') THEN RAISE EXCEPTION 'Invalid signed submission versions or required parts' USING ERRCODE='23514'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.manifest->'uploads') LOOP
  SELECT * INTO upload FROM gan_return_uploads WHERE id::text=entry->>'id';
  IF upload.id IS NULL OR upload.issue_id<>NEW.issue_id OR upload.actor_id<>NEW.actor_id OR upload.kind IS DISTINCT FROM entry->>'kind' OR upload.pdf_sha256 IS DISTINCT FROM entry->>'pdf_sha256' OR
    upload.version<>(SELECT MAX(version) FROM gan_return_uploads WHERE issue_id=NEW.issue_id AND kind=upload.kind) OR upload.source_pages IS DISTINCT FROM entry->'source_pages' OR (entry->>'pages')::integer IS DISTINCT FROM upload.pages OR (entry->>'version')::integer IS DISTINCT FROM upload.version OR
    upload.pdf_sha256 IS DISTINCT FROM encode(sha256(upload.pdf),'hex') THEN RAISE EXCEPTION 'Submission must use the current immutable originals' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR part IN SELECT value FROM jsonb_array_elements(issue.manifest->'parts') WHERE value->>'kind' IN ('gan','special_conditions') LOOP
  SELECT value INTO entry FROM jsonb_array_elements(NEW.manifest->'uploads') WHERE value->>'kind'=part->>'kind';
  IF entry IS NULL THEN RAISE EXCEPTION 'A required signed document is missing' USING ERRCODE='23514'; END IF;
  FOR page IN SELECT value FROM jsonb_array_elements(part->'signature_pages') LOOP
   IF NOT (entry->'source_pages') @> to_jsonb(ARRAY[(page::text)::integer-(part->>'page_start')::integer+1]) THEN RAISE EXCEPTION 'A required signature page is missing' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_return_submission ON gan_return_submissions;
CREATE TRIGGER protect_gan_return_submission BEFORE INSERT OR UPDATE OR DELETE ON gan_return_submissions FOR EACH ROW EXECUTE FUNCTION guard_gan_return_submission();
CREATE OR REPLACE FUNCTION verify_gan_return_submission_commit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM gan_workflow_events WHERE issue_id=NEW.issue_id AND action='submit_upload' AND evidence->>'submissionId'=NEW.id::text) THEN RAISE EXCEPTION 'A signed submission requires its atomic workflow event' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS commit_gan_return_submission ON gan_return_submissions;
CREATE CONSTRAINT TRIGGER commit_gan_return_submission AFTER INSERT ON gan_return_submissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_gan_return_submission_commit();
`;
