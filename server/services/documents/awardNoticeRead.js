import {accountError} from '../accountPolicy.js';
import {formActor,assertApplicationAccess} from '../forms/formAccess.js';
export async function readAwardNoticeHistory(db,actorId,applicationId) {
  const actor=await formActor(db,actorId),application=(await db.query('SELECT * FROM applications WHERE id::text=$1',[applicationId])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
  if(!organization)throw accountError(404,'Organization not found');
  assertApplicationAccess(actor,application,organization);
  return (await db.query('SELECT * FROM award_notices WHERE application_id=$1 ORDER BY gan_number',[applicationId])).rows;
}
