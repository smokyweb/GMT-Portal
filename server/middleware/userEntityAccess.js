import pool from '../db/connection.js';
import { accountActor, managedTarget } from '../services/accountRepository.js';
export function createUserMutationGuard(db=pool) {
 return async function guard(req,res,next) {
  if(req.params.entity!=='User') return next();
  const write=req.method==='PUT'||req.method==='DELETE'||(req.method==='POST'&&!req.originalUrl.endsWith('/filter'));
  if(!write) return next();
  try {
    await accountActor(db,req.user.id);
    if(req.method==='POST') return res.status(400).json({error:'Use the account invitation workflow to create users'});
    const {actor,target}=await managedTarget(db,req.user.id,req.params.id);
    if(req.method==='DELETE'&&actor.id===target.id) return res.status(400).json({error:'You cannot remove your own account'});
    const allowed=['full_name','title','department','phone','role','active_status','organization_id','organization_name','scope_state'];
    if(Object.keys(req.body||{}).some(key=>!allowed.includes(key))) return res.status(400).json({error:'Use the account access workflow for this account change'});
    if(req.body.role && (!['user','reviewer','admin','isc_admin'].includes(req.body.role) ||
      (actor.role!=='isc_admin'&&req.body.role!=='user'))) return res.status(403).json({error:'This role change is not permitted'});
    next();
  } catch(error) {
    res.status(error.status||500).json({error:error.status?error.message:'Unable to update user'});
  }
}

}
export const guardUserMutation=createUserMutationGuard();
