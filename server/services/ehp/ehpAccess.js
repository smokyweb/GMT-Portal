import {accountError} from '../accountPolicy.js';
import {formActor,assertApplicationAccess} from '../forms/formAccess.js';
import {parseObject} from '../../../src/lib/forms/defaultForm.js';
export async function ehpApplication(db,actorId,id,lock=false) {
  const actor=await formActor(db,actorId);
  const application=(await db.query('SELECT * FROM applications WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
  assertApplicationAccess(actor,application,organization);
  return {actor,application,organization};
}
export function requireEhpAdmin(actor) {
  if(!['isc_admin','admin'].includes(actor.role))throw accountError(403,'An assigned administrator must record EHP approval');
}
export function needsEhp(application,budgets=[]) {
  if(application.ehp_required||application.ehp_manual_required||budgets.some(line=>line.ehp_affected===true))return true;
  if(application.ehp_status==='NotRequired')return false;
  const answers=parseObject(application.ehp_screening_answers);
  return Object.entries(answers).some(([key,value])=>key!=='q10'&&['yes','unknown','unsure'].includes(String(value).toLowerCase()));
}
export function hasEhpApproval(application) {
  return application.ehp_status==='Approved'&&Boolean(application.ehp_approval_date);
}
export function expectEhpRevision(application,input) {
  if(input.expectedRevision!==application.ehp_review_revision)throw accountError(409,'EHP review changed. Reload before saving.');
}
