import {transaction} from '../accountRepository.js';
import {accountError,normalizedState} from '../accountPolicy.js';
import {auditForm,formActor} from '../forms/formAccess.js';
import {findAccount} from '../accountRepository.js';
import {ganGranteeSettingsAccess} from './ganSettingsAccess.js';
import {GRANTEE_GAN_FIELDS,ganSettingsInput,eligibleGanApprover,ganContactPerson} from './ganSettingsPolicy.js';
export async function readGanGranteeSettings(db,actorId,id) {
  const {grantee}=await ganGranteeSettingsAccess(db,actorId,id);
  const users=(await db.query(`SELECT u.id,u.full_name,u.email,u.title,u.phone,u.organization_id,u.role,u.scope_state,u.grantee_id,u.active_status,g.state_code AS grantee_state
    FROM users u LEFT JOIN grantees g ON g.id::text=u.grantee_id WHERE u.role IN ('admin','isc_admin') ORDER BY u.full_name,u.email`)).rows;
  const current=users.find(user=>user.id===grantee.approving_official_id),official=eligibleGanApprover(current,grantee)?ganContactPerson(current):null;
  const settings=Object.fromEntries(GRANTEE_GAN_FIELDS.map(key=>[key,grantee[key]||null]));
  if(official)settings.approving_official_name=official.full_name;
  return {grantee:{id:grantee.id,name:grantee.name,state:grantee.state_code,is_active:grantee.is_active},settings,revision:grantee.gan_settings_revision||0,can_edit:true,official,
    choices:{approvers:users.filter(user=>eligibleGanApprover(user,grantee)).map(ganContactPerson)},
    warnings:grantee.approving_official_id&&!official?['The configured portal approver is inactive, missing, or outside this agency. Select a replacement or explicitly use print-only approver details.']:[]};
}
export async function saveGanGranteeSettings(pool,actorId,id,input,ip='') {
  const changes=ganSettingsInput(input,GRANTEE_GAN_FIELDS);
  return transaction(pool,async db=>{
    const {actor,grantee}=await ganGranteeSettingsAccess(db,actorId,id,true);
    if(input.expectedRevision!==(grantee.gan_settings_revision||0))throw accountError(409,'Grantee award settings changed. Reload before saving.');
    const data=Object.fromEntries(GRANTEE_GAN_FIELDS.map(key=>[key,grantee[key]||null]));Object.assign(data,changes);
    if(data.approving_official_id) {
      const official=await findAccount(db,data.approving_official_id);
      if(!eligibleGanApprover(official,grantee))throw accountError(403,'Choose an active administrator assigned to this grantee state and agency');
      data.approving_official_name=official.full_name||null;
    }
    await db.query("SELECT set_config('gmt.gan_settings_action','grantee',true)");
    const keys=GRANTEE_GAN_FIELDS;
    await db.query('UPDATE grantees SET '+keys.map((key,i)=>key+'=$'+(i+2)).join(',')+',updated_date=NOW() WHERE id=$1',[grantee.id,...keys.map(key=>data[key])]);
    await auditForm(db,actor,grantee.id,'GranteeAwardSettingsUpdated','Updated GAN contact/approver fields: '+Object.keys(changes).join(', ')+(ip?' IP: '+String(ip).slice(0,100):''),'Grantee');
    return readGanGranteeSettings(db,actorId,id);
  });
}
export async function ganSettingsDirectory(db,actorId) {
  const actor=await formActor(db,actorId),state=normalizedState(actor.scope_state||actor.grantee_state);
  if(!['admin','isc_admin'].includes(actor.role)||actor.role!=='isc_admin'&&!state)throw accountError(403,'An assigned administrator must configure grantee settings');
  return {grantees:(await db.query('SELECT id,name,state_code,is_active FROM grantees ORDER BY name,id')).rows.filter(row=>actor.role==='isc_admin'||normalizedState(row.state_code)===state&&(!actor.grantee_id||actor.grantee_id===row.id))};
}
