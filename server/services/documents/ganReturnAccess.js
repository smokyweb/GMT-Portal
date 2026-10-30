import {accountError} from '../accountPolicy.js';
import {assertGanRecipient} from './ganWorkflowAccess.js';
export function assertGanVerifier(access,issue) {
  if(!['admin','isc_admin','reviewer'].includes(access.actor.role))throw accountError(403,'Assigned NEMA grants staff must verify signed uploads');
  if(access.actor.role!=='isc_admin'&&access.actor.grantee_id&&access.actor.grantee_id!==issue.manifest.gan.sources.granteeId)throw accountError(403,'This GAN belongs to another assigned grantee');
}
export async function currentGanReturnIssue(db,access,{upload=false}={}) {
  const state=(await db.query('SELECT * FROM gan_workflows WHERE document_id=$1',[access.document.id])).rows[0];
  if(!state||access.document.status==='Draft')throw accountError(409,'This GAN has no current issued package');
  const {loadGanIssue}=await import('./ganWorkflowIntegrity.js'),issue=await loadGanIssue(db,state.issue_id);
  if(upload){
    assertGanRecipient(access,issue);
    if(!issue.manifest.allowed_methods.includes('upload'))throw accountError(403,'This issued template allows electronic signing only');
    if(!['Reviewed','UploadReturned'].includes(state.phase))throw accountError(409,'Review the current issued package, or wait for a return before replacing submitted files');
  }
  return {state,issue};
}
