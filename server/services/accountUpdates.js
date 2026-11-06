import {accountError,assertAccountAccess,normalizedState,publicAccount} from './accountPolicy.js';
import {auditAccount,managedTarget,transaction} from './accountRepository.js';
import {syncMemberships} from './organizationMembership.js';
const allowed=['email','full_name','title','department','phone','role','active_status','organization_id','organization_name','organization_ids','scope_state'];
export async function updateManagedAccount(pool,actorId,targetId,input,ip) {
  return transaction(pool,db=>updateAccountInTransaction(db,actorId,targetId,input,ip));
}
export async function updateAccountInTransaction(db,actorId,targetId,input,ip) {
    const {actor,target}=await managedTarget(db,actorId,targetId);
    if(Object.keys(input).some(key=>!allowed.includes(key))) throw accountError(400,'Use the account access workflow for this change');
    const data=Object.fromEntries(Object.entries(input).filter(([key])=>!['organization_name','organization_ids'].includes(key)));
    if(!Object.keys(data).length) throw accountError(400,'No valid account fields');
    if(data.email!==undefined){data.email=String(data.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw accountError(400,'Enter a valid email address');const duplicate=await db.query('SELECT id FROM users WHERE lower(email)=lower($1) AND id::text<>$2 LIMIT 1',[data.email,targetId]);if(duplicate.rowCount)throw accountError(409,'That email address is already in use');}
    const role=data.role||target.role;
    if(!['user','reviewer','admin','isc_admin'].includes(role)) throw accountError(400,'Invalid role');
    if(actor.role!=='isc_admin'&&role==='isc_admin') throw accountError(403,'State administrators cannot assign the ISC Administrator role');
    if(data.active_status && data.active_status!==target.active_status&&!['active','inactive'].includes(data.active_status)) {
      throw accountError(400,'Choose an active or inactive account status');
    }
    let org;
    if(input.organization_ids!==undefined) {
      if(role!=='user') throw accountError(400,'Organization memberships are only assigned to subrecipient users');
      const organizations=await syncMemberships(db,actor,target,input.organization_ids);
      data.organization_id=organizations[0]?.id||null;
      data.organization_name=organizations[0]?.name||null;
      data.scope_state=normalizedState(organizations[0]?.state)||null;
    } else if(data.organization_id!==undefined) {
      if(data.organization_id && data.organization_id!=='__none__') {
        org=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[data.organization_id])).rows[0];
        if(!org||org.is_active===false) throw accountError(400,'Select an active organization');
        data.organization_id=org.id;data.organization_name=org.name;
        data.scope_state=normalizedState(org.state);
      } else {data.organization_id=null;data.organization_name=null;}
    }
    if(data.scope_state!==undefined) {
      data.scope_state=normalizedState(data.scope_state)||null;
      if(data.scope_state&&!/^[A-Z]{2}$/.test(data.scope_state)) throw accountError(400,'State must use a two-letter code');
    }
    const proposed={...target,...data,role,organization_state:org?.state||target.organization_state};
    assertAccountAccess(actor,proposed);
    const keys=Object.keys(data);
    const securityChange=keys.some(key=>['role','active_status','organization_id','scope_state'].includes(key)&&data[key]!==target[key]);
    const {rows}=await db.query(`UPDATE users SET ${keys.map((key,i)=>key+'=$'+(i+2)).join(',')},
      auth_version=auth_version+$${keys.length+2},updated_date=NOW() WHERE id=$1 RETURNING *`,
      [targetId,...Object.values(data),securityChange?1:0]);
    await auditAccount(db,actor,targetId,'UserUpdated','Updated account fields: '+keys.join(', ')+(securityChange?'; active sessions revoked':''),ip);
    return publicAccount(rows[0]);
}

export async function bulkUpdateManagedAccounts(pool,actorId,ids,changes,ip) {
  if(!Array.isArray(ids)||!ids.length||ids.length>200||new Set(ids).size!==ids.length) {
    throw accountError(400,'Select between 1 and 200 distinct accounts');
  }
  if(Object.keys(changes||{}).length!==1||!['role','active_status'].includes(Object.keys(changes)[0])) {
    throw accountError(400,'Choose a role or status change');
  }
  return transaction(pool,async db=>{
    const updated=[];
    for(const id of [...ids].sort())updated.push(await updateAccountInTransaction(db,actorId,id,changes,ip));
    return {users:updated,updated:updated.length};
  });
}
