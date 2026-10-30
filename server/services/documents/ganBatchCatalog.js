import {ganBatchList} from './ganBatchList.js';
import {accountError,normalizedState} from '../accountPolicy.js';
import {formActor} from '../forms/formAccess.js';
import {ganBatchActor} from './ganBatchAccess.js';
import {ganBatchCandidates} from './ganBatchCandidates.js';
export async function ganBatchCatalog(db,actorId,nofoId) {
  const actor=await formActor(db,actorId);
  if(!['admin','isc_admin'].includes(actor.role))throw accountError(403,'An assigned administrator must prepare award documents');
  const state=normalizedState(actor.scope_state||actor.grantee_state);
  if(actor.role!=='isc_admin'&&!state)throw accountError(403,'Your administrator account needs a state assignment');
  const nofos=(await db.query('SELECT id,title,program_code,scope_states FROM nofos ORDER BY title,id')).rows.filter(row=>actor.role==='isc_admin'||!row.scope_states?.length||row.scope_states.map(normalizedState).includes(state));
  const templates=(await db.query("SELECT id,name,version,program_codes FROM document_templates WHERE doc_type='Grant Award Notice' AND is_active=true AND version>0 ORDER BY name,id")).rows;
  const grantees=(await db.query('SELECT id,name,state_code FROM grantees WHERE is_active=true ORDER BY name,id')).rows.filter(row=>actor.role==='isc_admin'||normalizedState(row.state_code)===state&&(!actor.grantee_id||actor.grantee_id===row.id));
  const batches=await ganBatchList(db,actorId,nofos.map(nofo=>nofo.id));
  if(!nofoId)return {batches,nofos,templates,grantees,applications:[],organizations:[],officials:[]};
  const access=await ganBatchActor(db,actorId,nofoId),applications=await ganBatchCandidates(db,actor,access.nofo,access.state);
  const orgIds=[...new Set(applications.map(row=>row.organizationId).filter(Boolean))];
  const organizations=(await db.query("SELECT id,name,to_jsonb(organizations)->>'authorized_official_id' AS authorized_official_id,to_jsonb(organizations)->>'grantee_id' AS grantee_id FROM organizations WHERE id::text=ANY($1::text[]) ORDER BY name",[orgIds])).rows;
  const officials=(await db.query("SELECT id,full_name,email,title,organization_id FROM users WHERE organization_id=ANY($1::text[]) AND COALESCE(active_status,'active')='active' AND role='user' ORDER BY full_name,email",[orgIds])).rows;
  return {batches,nofos,templates,grantees,applications,organizations,officials};
}
