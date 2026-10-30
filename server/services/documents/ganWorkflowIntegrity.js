import {accountError} from '../accountPolicy.js';
import {ganPackageHash} from './ganPackagePolicy.js';
export function verifyGanIssue(issue) {
  if(!issue||!Buffer.isBuffer(issue.pdf)||ganPackageHash(issue.pdf)!==issue.pdf_sha256||issue.manifest_sha256!==issue.calculated_manifest_sha256||issue.manifest.pdf_sha256!==issue.pdf_sha256||issue.manifest.document_id!==issue.document_id||issue.manifest.package_id!==issue.package_id||issue.manifest.recipient_id!==issue.recipient_id||issue.manifest.gan.sources.organizationId!==issue.organization_id)throw accountError(500,'The issued GAN failed its integrity check');
  return issue;
}
export async function loadGanIssue(db,id) {
  const issue=(await db.query("SELECT *,encode(sha256(convert_to(manifest::text,'UTF8')),'hex') AS calculated_manifest_sha256 FROM gan_workflow_issues WHERE id::text=$1",[id])).rows[0];
  if(!issue)throw accountError(404,'Issued GAN not found');return verifyGanIssue(issue);
}
export function verifyGanWorkflowEvent(event) {
  if(event.evidence_sha256!==event.calculated_evidence_sha256||event.pdf&&(ganPackageHash(event.pdf)!==event.pdf_sha256))throw accountError(500,'The GAN action evidence failed its integrity check');
  return event;
}
export const ganWorkflowEventProjection=event=>({id:event.id,issue_id:event.issue_id,revision:event.revision,action:event.action,from_phase:event.from_phase,to_phase:event.to_phase,actor_id:event.actor_id,actor_email:event.actor_email,occurred_at:event.occurred_at,
  evidence:event.evidence,pdf_sha256:event.pdf_sha256});
