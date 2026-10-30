import {accountError} from '../accountPolicy.js';
import {ganDraftAccess} from './ganDraftAccess.js';
export async function ganWorkflowAccess(db,actorId,id,{lock=false}={}) {
  const document=(await db.query('SELECT * FROM generated_documents WHERE id::text=$1 AND gan_managed'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!document)throw accountError(404,'Managed GAN not found');
  const access=await ganDraftAccess(db,actorId,document.application_id);
  if(document.organization_id!==access.organization.id)throw accountError(409,'Reconcile this GAN’s original organization before continuing');
  if(access.actor.role==='admin'&&access.actor.grantee_id&&access.actor.grantee_id!==document.gan_grantee_id)throw accountError(403,'This GAN belongs to another assigned grantee');
  return {...access,document};
}
export function assertGanRecipient(access,issue) {
  if(access.actor.role!=='user'||access.actor.id!==issue.recipient_id||access.actor.organization_id!==issue.organization_id)throw accountError(403,'Only this GAN’s assigned registered official can review, sign or reject it');
}
export function assertGanSender(access) {if(!['admin','isc_admin'].includes(access.actor.role))throw accountError(403,'An assigned administrator must send this GAN');}
