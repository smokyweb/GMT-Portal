import {ganWorkflowGuards} from './ganWorkflowGuards.js';
// Explicit staging migration; not imported or mounted by production startup.
export async function migrateGanWorkflow(db) {
  const required=['notifications','workflow_rules'];for(const name of required)if(!(await db.query('SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1',[name])).rows.length)throw Error('GAN workflow requires its own existing '+name+' table');
  await db.query(`
    CREATE TABLE IF NOT EXISTS gan_signature_settings (
      template_id UUID PRIMARY KEY REFERENCES document_templates(id),revision INTEGER NOT NULL CHECK(revision>0),
      allowed_methods TEXT[] NOT NULL CHECK(cardinality(allowed_methods) BETWEEN 1 AND 2 AND allowed_methods<@ARRAY['electronic','upload']::text[]),
      actor_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gan_workflow_issues (
      id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),package_id UUID NOT NULL REFERENCES gan_package_snapshots(id),
      gan_revision INTEGER NOT NULL,organization_id TEXT NOT NULL,nofo_id TEXT NOT NULL,recipient_id TEXT NOT NULL,approver_id TEXT,
      sender_id TEXT NOT NULL,sender_email TEXT NOT NULL,issued_at TIMESTAMPTZ NOT NULL,manifest JSONB NOT NULL,manifest_sha256 TEXT NOT NULL,
      pdf BYTEA NOT NULL,pdf_sha256 TEXT NOT NULL,FOREIGN KEY(document_id,gan_revision) REFERENCES gan_document_snapshots(document_id,revision)
    );
    CREATE TABLE IF NOT EXISTS gan_workflow_events (
      id UUID PRIMARY KEY,document_id UUID NOT NULL REFERENCES generated_documents(id),issue_id UUID NOT NULL REFERENCES gan_workflow_issues(id),
      revision INTEGER NOT NULL CHECK(revision>0),request_id UUID NOT NULL,request_sha256 TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('send','open','sign','reject')),from_phase TEXT NOT NULL,to_phase TEXT NOT NULL,
      actor_id TEXT NOT NULL,actor_role TEXT NOT NULL,actor_email TEXT NOT NULL,occurred_at TIMESTAMPTZ NOT NULL,ip TEXT NOT NULL,
      evidence JSONB NOT NULL,evidence_sha256 TEXT NOT NULL,pdf BYTEA,pdf_sha256 TEXT,
      UNIQUE(document_id,revision),UNIQUE(document_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS gan_workflows (
      document_id UUID PRIMARY KEY REFERENCES generated_documents(id),issue_id UUID NOT NULL REFERENCES gan_workflow_issues(id),
      revision INTEGER NOT NULL CHECK(revision>0),phase TEXT NOT NULL CHECK(phase IN ('Sent','Reviewed','RecipientSigned','Rejected')),
      last_event_id UUID NOT NULL REFERENCES gan_workflow_events(id),updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gan_workflow_delivery (
      id UUID PRIMARY KEY,event_id UUID NOT NULL REFERENCES gan_workflow_events(id),user_id TEXT NOT NULL,recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL,rule_ids JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status='pending'),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(event_id,user_id)
    );
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS gan_workflow_event_id UUID REFERENCES gan_workflow_events(id);
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS gan_workflow_user_id TEXT;
  `);
  await db.query(ganWorkflowGuards);
}
