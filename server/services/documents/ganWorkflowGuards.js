import {GAN_SIGNATURE_CONSENTS,GAN_SIGNATURE_CONSENT_VERSION} from './ganWorkflowPolicy.js';
export const ganWorkflowGuards=`
CREATE OR REPLACE FUNCTION guard_gan_workflow_append() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE issue gan_workflow_issues%ROWTYPE; prior gan_workflows%ROWTYPE; doc generated_documents%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'workflow' THEN RAISE EXCEPTION 'GAN workflow history and delivery requests are immutable' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='gan_workflow_issues' THEN
    IF NEW.pdf_sha256 IS DISTINCT FROM encode(sha256(NEW.pdf),'hex') OR NEW.manifest_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.manifest::text,'UTF8')),'hex') OR
      NEW.manifest->>'pdf_sha256' IS DISTINCT FROM NEW.pdf_sha256 OR NEW.manifest->>'recipient_id' IS DISTINCT FROM NEW.recipient_id OR
      NEW.manifest->>'document_id' IS DISTINCT FROM NEW.document_id::text OR NEW.manifest->>'package_id' IS DISTINCT FROM NEW.package_id::text OR
      NEW.manifest->'gan'->'sources'->>'organizationId' IS DISTINCT FROM NEW.organization_id OR NEW.manifest->'package'->>'nofo_id' IS DISTINCT FROM NEW.nofo_id THEN
      RAISE EXCEPTION 'Issued package hashes or recipient do not match' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM gan_package_snapshots p JOIN generated_documents d ON d.id=p.document_id
      WHERE p.id=NEW.package_id AND d.id=NEW.document_id AND d.status='Draft' AND d.gan_revision=NEW.gan_revision
      AND p.gan_revision=NEW.gan_revision AND p.organization_id=NEW.organization_id
      AND p.pdf_sha256=NEW.manifest->>'draft_package_sha256' AND d.gan_authorized_official_id=NEW.recipient_id) THEN
      RAISE EXCEPTION 'Issue must reference the current draft and saved package' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='gan_workflow_events' THEN
    SELECT * INTO issue FROM gan_workflow_issues WHERE id=NEW.issue_id;
    SELECT * INTO prior FROM gan_workflows WHERE document_id=NEW.document_id;
    SELECT * INTO doc FROM generated_documents WHERE id=NEW.document_id;
    IF issue.document_id IS DISTINCT FROM NEW.document_id OR NEW.revision<>COALESCE(prior.revision,0)+1 OR NEW.evidence_sha256 IS DISTINCT FROM encode(sha256(convert_to(NEW.evidence::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'Invalid workflow event identity, revision or evidence' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM users WHERE id::text=NEW.actor_id AND role=NEW.actor_role AND email=NEW.actor_email AND (active_status IS NULL OR active_status='active')) THEN RAISE EXCEPTION 'Workflow actor must be an active registered account' USING ERRCODE='42501'; END IF;
    IF NEW.action='send' THEN
      IF NEW.from_phase<>'Draft' OR NEW.to_phase<>'Sent' OR NEW.actor_role NOT IN ('admin','isc_admin') OR doc.status<>'Draft' OR issue.gan_revision<>doc.gan_revision OR
        (prior.issue_id=NEW.issue_id) THEN RAISE EXCEPTION 'Invalid send transition' USING ERRCODE='23514'; END IF;
    ELSIF NEW.action IN ('submit_upload','accept_upload','return_upload') THEN
      IF to_regprocedure(format('%I.verify_gan_return_event(jsonb)',current_schema())) IS NULL THEN RAISE EXCEPTION 'Signed returns are not enabled' USING ERRCODE='42501'; END IF;
      EXECUTE format('SELECT %I.verify_gan_return_event($1)',current_schema()) USING to_jsonb(NEW);
    ELSE
      IF prior.issue_id IS DISTINCT FROM NEW.issue_id OR prior.phase IS DISTINCT FROM NEW.from_phase OR NEW.actor_role<>'user' OR NEW.actor_id<>issue.recipient_id OR
        NOT EXISTS(SELECT 1 FROM users WHERE id::text=NEW.actor_id AND organization_id=issue.organization_id) THEN RAISE EXCEPTION 'Only the issued recipient may act on the current GAN' USING ERRCODE='42501'; END IF;
      IF ((NEW.action='open' AND NEW.from_phase IN ('Sent','Reviewed') AND NEW.to_phase='Reviewed') OR
        (NEW.action='reject' AND NEW.from_phase='Reviewed' AND NEW.to_phase='Rejected' AND length(COALESCE(NEW.evidence->>'note',''))>0) OR
        (NEW.action='sign' AND NEW.from_phase='Reviewed' AND NEW.to_phase='RecipientSigned' AND NEW.evidence->>'issuedPdfSha256'=issue.pdf_sha256
          AND issue.manifest->'allowed_methods' ? 'electronic' AND NEW.evidence->>'consentVersion'='${GAN_SIGNATURE_CONSENT_VERSION}' AND NEW.evidence->'consents'='${JSON.stringify(GAN_SIGNATURE_CONSENTS).replace(/'/g,"''")}'::jsonb AND NEW.evidence->'confirmed' @> '{"electronic":true,"conditions":true,"authority":true}'::jsonb
          AND NEW.evidence->>'actorId'=NEW.actor_id AND NEW.evidence->>'actorEmail'=NEW.actor_email AND NEW.evidence->>'issueId'=NEW.issue_id::text AND NEW.evidence->>'eventId'=NEW.id::text
          AND (NEW.evidence->>'signedAt')::timestamptz=NEW.occurred_at AND NEW.evidence->>'ip'=NEW.ip AND length(NEW.evidence->>'name')>0 AND length(NEW.evidence->>'title')>0
          AND NEW.pdf IS NOT NULL AND NEW.pdf_sha256=encode(sha256(NEW.pdf),'hex'))) IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid GAN status transition' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_workflow_issue ON gan_workflow_issues;
CREATE TRIGGER protect_gan_workflow_issue BEFORE INSERT OR UPDATE OR DELETE ON gan_workflow_issues FOR EACH ROW EXECUTE FUNCTION guard_gan_workflow_append();
DROP TRIGGER IF EXISTS protect_gan_workflow_event ON gan_workflow_events;
CREATE TRIGGER protect_gan_workflow_event BEFORE INSERT OR UPDATE OR DELETE ON gan_workflow_events FOR EACH ROW EXECUTE FUNCTION guard_gan_workflow_append();
DROP TRIGGER IF EXISTS protect_gan_workflow_delivery ON gan_workflow_delivery;
CREATE TRIGGER protect_gan_workflow_delivery BEFORE INSERT OR UPDATE OR DELETE ON gan_workflow_delivery FOR EACH ROW EXECUTE FUNCTION guard_gan_workflow_append();
CREATE OR REPLACE FUNCTION guard_gan_workflow_master() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'workflow' THEN RAISE EXCEPTION 'Use the owned GAN transition function' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM gan_workflow_events WHERE id=NEW.last_event_id AND document_id=NEW.document_id AND issue_id=NEW.issue_id AND revision=NEW.revision AND to_phase=NEW.phase) THEN RAISE EXCEPTION 'GAN state must match its recorded event' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.document_id<>OLD.document_id OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Invalid workflow revision' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_workflow_master ON gan_workflows;
CREATE TRIGGER protect_gan_workflow_master BEFORE INSERT OR UPDATE OR DELETE ON gan_workflows FOR EACH ROW EXECUTE FUNCTION guard_gan_workflow_master();
CREATE OR REPLACE FUNCTION verify_gan_document_transition(previous JSONB,updated JSONB) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE current_event gan_workflow_events%ROWTYPE; issue gan_workflow_issues%ROWTYPE; expected TEXT;
BEGIN
  IF (previous-ARRAY['status','sent_by','sent_at','signed_by','signed_at','subrecipient_notes','updated_date']) IS DISTINCT FROM
     (updated-ARRAY['status','sent_by','sent_at','signed_by','signed_at','subrecipient_notes','updated_date']) THEN RAISE EXCEPTION 'A status transition cannot replace the GAN snapshot' USING ERRCODE='42501'; END IF;
  SELECT e.* INTO current_event FROM gan_workflows w JOIN gan_workflow_events e ON e.id=w.last_event_id WHERE w.document_id::text=updated->>'id';
  SELECT * INTO issue FROM gan_workflow_issues WHERE id=current_event.issue_id;
  expected=CASE current_event.to_phase WHEN 'RecipientSigned' THEN 'Signed' ELSE current_event.to_phase END;
  IF expected IS NULL OR updated->>'status' IS DISTINCT FROM expected OR (updated->>'gan_revision')::integer IS DISTINCT FROM issue.gan_revision OR
    updated->>'sent_by' IS DISTINCT FROM issue.sender_email OR (updated->>'sent_at')::timestamptz IS DISTINCT FROM issue.issued_at THEN RAISE EXCEPTION 'Document status must match its owned workflow event' USING ERRCODE='23514'; END IF;
  IF expected='Signed' THEN
    IF updated->>'signed_by' IS DISTINCT FROM current_event.actor_email OR (updated->>'signed_at')::timestamptz IS DISTINCT FROM current_event.occurred_at THEN RAISE EXCEPTION 'Signature metadata must match its event' USING ERRCODE='23514'; END IF;
  ELSIF expected='Verified' THEN
    EXECUTE format('SELECT %I.verify_gan_verified_metadata($1,$2)',current_schema()) USING updated,to_jsonb(current_event);
  ELSIF updated->>'signed_by' IS NOT NULL OR updated->>'signed_at' IS NOT NULL THEN RAISE EXCEPTION 'This GAN has not been signed' USING ERRCODE='23514'; END IF;
  IF expected IN ('Rejected','UploadReturned') AND updated->>'subrecipient_notes' IS DISTINCT FROM current_event.evidence->>'note' THEN RAISE EXCEPTION 'Rejection notes must match the event' USING ERRCODE='23514'; END IF;
END $$;
CREATE OR REPLACE FUNCTION verify_gan_workflow_commit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE doc generated_documents%ROWTYPE; state gan_workflows%ROWTYPE; latest gan_workflow_events%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='gan_workflow_issues' AND NOT EXISTS(SELECT 1 FROM gan_workflow_events WHERE issue_id=NEW.id AND action='send') THEN RAISE EXCEPTION 'An issued package requires its atomic send event' USING ERRCODE='23514'; END IF;
  SELECT * INTO state FROM gan_workflows WHERE document_id=NEW.document_id;
  SELECT * INTO latest FROM gan_workflow_events WHERE document_id=NEW.document_id ORDER BY revision DESC LIMIT 1;
  SELECT * INTO doc FROM generated_documents WHERE id=NEW.document_id;
  IF state.last_event_id IS DISTINCT FROM latest.id OR state.revision IS DISTINCT FROM latest.revision OR state.phase IS DISTINCT FROM latest.to_phase THEN RAISE EXCEPTION 'GAN event and current state must commit together' USING ERRCODE='23514'; END IF;
  PERFORM verify_gan_document_transition(to_jsonb(doc),to_jsonb(doc));RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS commit_gan_workflow_issue ON gan_workflow_issues;
CREATE CONSTRAINT TRIGGER commit_gan_workflow_issue AFTER INSERT ON gan_workflow_issues DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_gan_workflow_commit();
DROP TRIGGER IF EXISTS commit_gan_workflow_event ON gan_workflow_events;
CREATE CONSTRAINT TRIGGER commit_gan_workflow_event AFTER INSERT ON gan_workflow_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_gan_workflow_commit();
CREATE OR REPLACE FUNCTION guard_gan_signature_settings() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'workflow_settings' THEN RAISE EXCEPTION 'Use the owned signature settings workflow' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' AND NEW.revision<>1 OR TG_OP='UPDATE' AND (NEW.template_id<>OLD.template_id OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Invalid signature settings revision' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_signature_settings ON gan_signature_settings;
CREATE TRIGGER protect_gan_signature_settings BEFORE INSERT OR UPDATE OR DELETE ON gan_signature_settings FOR EACH ROW EXECUTE FUNCTION guard_gan_signature_settings();
CREATE OR REPLACE FUNCTION guard_gan_workflow_notification() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN IF OLD.gan_workflow_event_id IS NOT NULL THEN RAISE EXCEPTION 'Managed GAN alerts cannot be deleted' USING ERRCODE='42501'; END IF;RETURN OLD; END IF;
  IF TG_OP='UPDATE' AND OLD.gan_workflow_event_id IS NOT NULL THEN
    IF current_setting('gmt.gan_action',true) IS DISTINCT FROM 'notification_read' OR current_setting('gmt.gan_notification_actor',true) IS DISTINCT FROM OLD.gan_workflow_user_id OR
      (to_jsonb(NEW)-ARRAY['is_read','updated_date']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['is_read','updated_date']) THEN RAISE EXCEPTION 'Only the named recipient may mark this GAN alert read' USING ERRCODE='42501'; END IF;
  ELSIF NEW.gan_workflow_event_id IS NOT NULL AND (TG_OP<>'INSERT' OR current_setting('gmt.gan_action',true) IS DISTINCT FROM 'workflow' OR NEW.gan_workflow_user_id IS NULL) THEN RAISE EXCEPTION 'Use the owned GAN alert workflow' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_gan_workflow_notification ON notifications;
CREATE TRIGGER protect_gan_workflow_notification BEFORE INSERT OR UPDATE OR DELETE ON notifications FOR EACH ROW EXECUTE FUNCTION guard_gan_workflow_notification();
`;
