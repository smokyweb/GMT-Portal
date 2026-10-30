import {ganReturnGuards} from './ganReturnGuards.js';
import {ganReturnEventGuards} from './ganReturnEventGuards.js';
// Explicit isolated-stage extension. Never mounted by production startup.
export async function migrateGanReturns(db) {
  for(const table of ['gan_workflow_events','gan_workflows','generated_documents'])if(!(await db.query('SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1',[table])).rows.length)throw Error('Signed returns require their own '+table+' table');
  await db.query(`
   CREATE TABLE IF NOT EXISTS gan_return_uploads (
    id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),issue_id UUID NOT NULL REFERENCES gan_workflow_issues(id),
    kind TEXT NOT NULL CHECK(kind IN ('gan','special_conditions','direct_deposit')),version INTEGER NOT NULL CHECK(version>0),workflow_revision INTEGER NOT NULL CHECK(workflow_revision>0),
    actor_id TEXT NOT NULL,filename TEXT NOT NULL CHECK(length(filename) BETWEEN 1 AND 180),pages INTEGER NOT NULL CHECK(pages BETWEEN 1 AND 150),source_pages JSONB NOT NULL,
    pdf BYTEA NOT NULL,pdf_sha256 TEXT NOT NULL,byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 20 AND 10485760),
    request_id UUID NOT NULL,request_sha256 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(issue_id,kind,version),UNIQUE(issue_id,request_id)
   );
   CREATE TABLE IF NOT EXISTS gan_return_submissions (
    id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),issue_id UUID NOT NULL REFERENCES gan_workflow_issues(id),
    submission_number INTEGER NOT NULL CHECK(submission_number>0),actor_id TEXT NOT NULL,manifest JSONB NOT NULL,manifest_sha256 TEXT NOT NULL,
    pdf BYTEA NOT NULL CHECK(octet_length(pdf) BETWEEN 20 AND 25165824),pdf_sha256 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL,UNIQUE(issue_id,submission_number)
   );
   ALTER TABLE gan_workflow_events DROP CONSTRAINT IF EXISTS gan_workflow_events_action_check;
   ALTER TABLE gan_workflow_events ADD CONSTRAINT gan_workflow_events_action_check CHECK(action IN ('send','open','sign','reject','submit_upload','accept_upload','return_upload'));
   ALTER TABLE gan_workflows DROP CONSTRAINT IF EXISTS gan_workflows_phase_check;
   ALTER TABLE gan_workflows ADD CONSTRAINT gan_workflows_phase_check CHECK(phase IN ('Sent','Reviewed','RecipientSigned','Rejected','Uploaded','UploadReturned','Verified'));
   ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_status_check;
   ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_status_check CHECK(status IN ('Draft','Sent','Reviewed','Signed','Rejected') OR gan_managed AND status IN ('Uploaded','UploadReturned','Verified'));
  `);
  await db.query(ganReturnGuards);await db.query(ganReturnEventGuards);
}
