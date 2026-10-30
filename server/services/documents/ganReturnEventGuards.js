import {GAN_RETURN_CHECKLIST} from './ganReturnPolicy.js';
const completed=JSON.stringify(Object.fromEntries(Object.keys(GAN_RETURN_CHECKLIST).map(key=>[key,true])));
export const ganReturnEventGuards=`
CREATE OR REPLACE FUNCTION verify_gan_return_event(event JSONB) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE issue gan_workflow_issues%ROWTYPE; state gan_workflows%ROWTYPE; submission gan_return_submissions%ROWTYPE; actor users%ROWTYPE; evidence JSONB;
BEGIN
 SELECT * INTO issue FROM gan_workflow_issues WHERE id::text=event->>'issue_id'; SELECT * INTO state FROM gan_workflows WHERE document_id=issue.document_id;
 SELECT * INTO actor FROM users WHERE id::text=event->>'actor_id';evidence=event->'evidence';
 SELECT * INTO submission FROM gan_return_submissions WHERE id::text=evidence->>'submissionId';
 IF state.issue_id IS DISTINCT FROM issue.id OR state.phase IS DISTINCT FROM event->>'from_phase' OR submission.id IS NULL OR submission.issue_id IS DISTINCT FROM issue.id OR
   evidence->>'issuedPdfSha256' IS DISTINCT FROM issue.pdf_sha256 OR evidence->>'uploadedPdfSha256' IS DISTINCT FROM submission.pdf_sha256 OR
   submission.pdf_sha256 IS DISTINCT FROM encode(sha256(submission.pdf),'hex') OR submission.manifest_sha256 IS DISTINCT FROM encode(sha256(convert_to(submission.manifest::text,'UTF8')),'hex') OR
   evidence->'recipient' IS DISTINCT FROM submission.manifest->'recipient' OR submission.submission_number<>(SELECT MAX(submission_number) FROM gan_return_submissions WHERE issue_id=issue.id) THEN
  RAISE EXCEPTION 'Return event must match the exact current signed submission' USING ERRCODE='23514'; END IF;
 IF event->>'action'='submit_upload' THEN
  IF state.phase NOT IN ('Reviewed','UploadReturned') OR event->>'to_phase'<>'Uploaded' OR actor.role<>'user' OR actor.id::text<>issue.recipient_id OR actor.organization_id<>issue.organization_id OR
    evidence->>'confirmed' IS DISTINCT FROM 'true' OR (event->>'occurred_at')::timestamptz IS DISTINCT FROM submission.created_at OR event->>'pdf_sha256' IS DISTINCT FROM submission.pdf_sha256 THEN
   RAISE EXCEPTION 'Only the issued official may submit their signed documents' USING ERRCODE='42501'; END IF;
 ELSE
  IF state.phase<>'Uploaded' OR actor.role NOT IN ('admin','reviewer','isc_admin') OR
    (actor.role<>'isc_admin' AND NOT EXISTS(SELECT 1 FROM organizations o LEFT JOIN grantees g ON g.id::text=actor.grantee_id
      WHERE o.id::text=issue.organization_id AND upper(trim(o.state))=upper(trim(COALESCE(actor.scope_state,g.state_code,'')))
      AND (actor.grantee_id IS NULL OR actor.grantee_id=issue.manifest->'gan'->'sources'->>'granteeId'))) THEN
   RAISE EXCEPTION 'Assigned NEMA grants staff must verify this GAN' USING ERRCODE='42501'; END IF;
  IF event->>'action'='accept_upload' THEN
   IF event->>'to_phase'<>'Verified' OR evidence->'checklist' IS DISTINCT FROM '${completed}'::jsonb THEN RAISE EXCEPTION 'Complete every verification check' USING ERRCODE='23514'; END IF;
  ELSIF event->>'action'='return_upload' THEN
   IF event->>'to_phase'<>'UploadReturned' OR length(trim(COALESCE(evidence->>'note',''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Returning requires correction notes' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported signed return action' USING ERRCODE='23514'; END IF;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION verify_gan_verified_metadata(document JSONB,event JSONB) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE submission gan_return_submissions%ROWTYPE;
BEGIN
 SELECT * INTO submission FROM gan_return_submissions WHERE id::text=event->'evidence'->>'submissionId';
 IF event->>'action'<>'accept_upload' OR document->>'signed_by' IS DISTINCT FROM submission.manifest->'recipient'->>'email' OR
   (document->>'signed_at')::timestamptz IS DISTINCT FROM submission.created_at THEN RAISE EXCEPTION 'Verified signature metadata must identify the submitted recipient, not the verifier' USING ERRCODE='23514'; END IF;
END $$;
`;
