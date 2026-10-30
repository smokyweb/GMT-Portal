import {accountError,normalizedState} from '../accountPolicy.js';
import {formActor} from '../forms/formAccess.js';
export async function ganOrganizationSettingsAccess(db,actorId,id,write=false,lock=false) {
  const actor=await formActor(db,actorId),organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!organization)throw accountError(404,'Organization not found');
  const admin=actor.role==='isc_admin'||actor.role==='admin'&&normalizedState(actor.scope_state||actor.grantee_state)&&normalizedState(actor.scope_state||actor.grantee_state)===normalizedState(organization.state)&&(!actor.grantee_id||!organization.grantee_id||actor.grantee_id===organization.grantee_id);
  if(!admin&&!(actor.role==='user'&&actor.organization_id===organization.id&&!write))throw accountError(403,'Only this organization’s assigned administrator can configure its award contacts');
  return {actor,organization,canEdit:Boolean(admin)};
}
export async function ganGranteeSettingsAccess(db,actorId,id,lock=false) {
  const actor=await formActor(db,actorId),grantee=(await db.query('SELECT * FROM grantees WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!grantee)throw accountError(404,'Grantee not found');
  const state=normalizedState(actor.scope_state||actor.grantee_state);
  if(actor.role!=='isc_admin'&&(actor.role!=='admin'||!state||state!==normalizedState(grantee.state_code)||actor.grantee_id&&actor.grantee_id!==grantee.id))throw accountError(403,'Only the assigned state or ISC administrator can configure this grantee');
  return {actor,grantee};
}
