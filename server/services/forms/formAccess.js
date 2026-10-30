import {accountError,normalizedState} from '../accountPolicy.js';
import {findAccount} from '../accountRepository.js';
export async function formActor(db,id) {
  const actor=await findAccount(db,id);
  if(!actor||!['active',undefined,null].includes(actor.active_status))throw accountError(401,'Sign in with an active account');
  return actor;
}
export function assertFormAdmin(actor,nofo) {
  if(actor.role==='isc_admin')return;
  const state=normalizedState(actor.scope_state||actor.grantee_state),states=nofo.scope_states||[];
  if(actor.role!=='admin'||!state||states.length!==1||normalizedState(states[0])!==state)throw accountError(403,'Only an assigned state administrator or ISC administrator can configure this NOFO');
}
export function assertNofoAccess(actor,nofo,organization,starting=false) {
  if(actor.role==='isc_admin')return;
  const state=normalizedState(organization?.state||actor.scope_state||actor.grantee_state||actor.organization_state);
  const states=nofo.scope_states||[];
  if(states.length&&(!state||!states.map(normalizedState).includes(state)))throw accountError(403,'This NOFO is outside your assigned state');
  if(actor.role==='user'&&starting) {
    if(!['Published','Active'].includes(nofo.status))throw accountError(403,'This NOFO is not accepting applications');
    const today=new Date().toISOString().slice(0,10),date=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10);
    if(nofo.open_date&&date(nofo.open_date)>today)throw accountError(409,'The application window has not opened');
    if(nofo.close_date&&date(nofo.close_date)<today)throw accountError(409,'The application window has closed');
  }
}
export function assertApplicationAccess(actor,application,organization,writing=false) {
  if(actor.role==='isc_admin')return;
  if(actor.role==='user') {
    if(!actor.organization_id||actor.organization_id!==application.organization_id)throw accountError(403,'This application belongs to another organization');
    if(writing&&!['Draft','RevisionRequested','ChangesRequested'].includes(application.status))throw accountError(409,'This application is not open for editing');
    return;
  }
  const state=normalizedState(actor.scope_state||actor.grantee_state);
  if(!['admin','reviewer'].includes(actor.role)||!state||state!==normalizedState(organization?.state))throw accountError(403,'This application is outside your assigned state');
}
export async function formNofo(db,id,lock=false) {
  const result=await db.query('SELECT * FROM nofos WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id]);
  if(!result.rows[0])throw accountError(404,'NOFO not found');
  return result.rows[0];
}
export async function auditForm(db,actor,id,action,description,type='Nofo') {
  await db.query(`INSERT INTO audit_logs(user_email,user_name,action,entity_type,entity_id,description)
    VALUES($1,$2,$3,$4,$5,$6)`,[actor.email,actor.full_name||actor.email,action,type,id,description]);
}
