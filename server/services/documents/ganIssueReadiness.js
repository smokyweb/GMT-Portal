import {accountError} from '../accountPolicy.js';
import {findAccount} from '../accountRepository.js';
import {eligibleRecipientOfficial} from './ganSettingsPolicy.js';
import {loadGanPreview} from './ganContext.js';
import {readGanDraft} from './ganDraftRead.js';
import {readGanPackage} from './ganPackageRead.js';
import {ganSignatureSettings} from './ganSignatureSettings.js';
import {ganWorkflowAccess,assertGanSender} from './ganWorkflowAccess.js';
export async function inspectGanIssue(db,access,packageId) {
  const {document,actor,organization}=access;assertGanSender(access);
  if(document.status!=='Draft')throw accountError(409,'Generate and review a Draft before sending this GAN');
  const saved=await readGanPackage(db,actor.id,packageId),latest=(await db.query('SELECT id FROM gan_package_snapshots WHERE document_id=$1 ORDER BY package_revision DESC LIMIT 1',[document.id])).rows[0];
  if(saved.package.document_id!==document.id||saved.package.gan_revision!==document.gan_revision||latest?.id!==packageId)throw accountError(409,'Choose the latest reviewed package for the current GAN revision');
  const draft=await readGanDraft(db,actor.id,document.id,document.gan_revision),snapshot=draft.snapshot,sources=snapshot.sources;
  const fresh=await loadGanPreview(db,actor.id,document.application_id,{templateId:snapshot.template_id,authorizedOfficialId:sources.authorizedOfficialId,granteeId:sources.granteeId,awardDate:snapshot.award_date,dueDate:snapshot.due_date});
  if(!fresh.ready)throw Object.assign(accountError(422,'Resolve the GAN source issues before sending'),{details:fresh.issues});
  const pinned=['awardRevision','organizationSettingsRevision','granteeSettingsRevision','nofoRevision','authorizedOfficialId','granteeId','approvingOfficialId','formVersionId'];
  if(fresh.body!==snapshot.merged_body||fresh.template.version!==snapshot.template_version||fresh.template.body_sha256!==snapshot.template_body_sha256||pinned.some(key=>fresh.sources[key]!==sources[key]))throw accountError(409,'GAN source records changed after generation. Regenerate and review a new draft package.');
  const recipient=await findAccount(db,sources.authorizedOfficialId);if(!eligibleRecipientOfficial(recipient,organization))throw accountError(403,'The issued recipient must remain an active registered official in this organization');
  const settings=await ganSignatureSettings(db,snapshot.template_id);
  return {saved,snapshot,sources,recipient,settings};
}
export async function readGanSendReadiness(pool,actorId,documentId,packageId) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const access=await ganWorkflowAccess(db,actorId,documentId);assertGanSender(access);
    const result=await inspectGanIssue(db,access,packageId),{snapshot,recipient,settings}=result;
    await db.query('COMMIT');
    return {ready:true,documentId,packageId,values:snapshot.values,projects:snapshot.projects,recipient:{id:recipient.id,name:snapshot.values.authorized_official_name,email:recipient.email},
      approver:{name:snapshot.values.approving_official_name,title:snapshot.values.approving_official_title},allowedMethods:settings.allowed_methods};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
