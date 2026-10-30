import {accountError} from '../accountPolicy.js';
// Existing grants without a managed GAN retain their existing funding workflow.
export async function assertGanFundingReady(db,applicationId) {
  const enabled=(await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='gan_workflows'")).rows.length;
  if(!enabled)return;
  const document=(await db.query('SELECT d.gan_revision,w.phase,i.gan_revision AS issued_revision FROM generated_documents d LEFT JOIN gan_workflows w ON w.document_id=d.id LEFT JOIN gan_workflow_issues i ON i.id=w.issue_id WHERE d.application_id=$1 AND d.gan_managed',[applicationId])).rows[0];
  if(document&&(document.phase!=='FullyExecuted'||document.issued_revision!==document.gan_revision))throw accountError(409,'The managed GAN must be fully executed by the subrecipient and NEMA before funding requests can proceed');
}
