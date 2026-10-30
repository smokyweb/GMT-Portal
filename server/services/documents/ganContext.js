import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {formActor,assertApplicationAccess,assertNofoAccess} from '../forms/formAccess.js';
import {resolveGanTokens} from '../../../src/lib/documents/ganTokens.js';
import {ganContextOptions,ganContextIssue,ganPublicPerson} from './ganContextPolicy.js';
import {ganSupportingRecords} from './ganContextRecords.js';
// Internal loader: the caller owns the transaction and must not trust an earlier preview.
export async function loadGanPreview(db,actorId,applicationId,input={}) {
  const options=ganContextOptions(input),actor=await formActor(db,actorId);
  if(!['admin','isc_admin'].includes(actor.role))throw accountError(403,'An assigned administrator must prepare award documents');
  const application=(await db.query('SELECT * FROM applications WHERE id::text=$1',[applicationId])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
  if(!organization)throw accountError(409,'Restore the application organization before preparing its GAN');
  assertApplicationAccess(actor,application,organization);
  const nofo=(await db.query('SELECT * FROM nofos WHERE id::text=$1',[application.nofo_id])).rows[0];
  if(!nofo)throw accountError(409,'Restore the application NOFO before preparing its GAN');
  assertNofoAccess(actor,nofo,organization);
  const records=await ganSupportingRecords(db,actor,application,organization,nofo,options);
  const context={...records,application,organization,nofo,actor:ganPublicPerson(actor),awardDate:options.awardDate,dueDate:options.dueDate};
  const resolved=resolveGanTokens(records.template.template_body||'',context),issues=[...records.issues,...resolved.issues];
  if(organization.is_active===false)issues.push(ganContextIssue('organization_name','Reactivate the recipient organization before issuing a GAN','Organization',organization.id,'is_active','Organizations › Edit Organization'));
  const unique=[...new Map(issues.map(issue=>[JSON.stringify(issue),issue])).values()];
  return {...resolved,issues:unique,ready:unique.length===0,previewOnly:true,
    template:{id:records.template.id||null,name:records.template.name||null,version:records.template.version||null,body:records.template.template_body||'',body_sha256:createHash('sha256').update(records.template.template_body||'').digest('hex')},
    sources:{applicationId:application.id,nofoId:nofo.id,organizationId:organization.id,awardId:records.award.id||null,awardRevision:records.award.revision??null,
      organizationSettingsRevision:organization.gan_settings_revision??null,granteeSettingsRevision:records.grantee.gan_settings_revision??null,approvingOfficialId:records.approvingOfficial?.id||null,
      formVersionId:application.form_version_id||null,nofoRevision:nofo.award_metadata_revision??null,authorizedOfficialId:records.authorizedOfficial.id||null,granteeId:records.grantee.id||null}};
}
// Read-only preparation only. Deliberately not mounted in the production server.
export async function previewGanFromRecords(pool,actorId,applicationId,input={}) {
  ganContextOptions(input);const db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result=await loadGanPreview(db,actorId,applicationId,input);
    await db.query('COMMIT');return result;
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
