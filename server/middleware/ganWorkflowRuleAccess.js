import {formActor} from '../services/forms/formAccess.js';
import {accountError} from '../services/accountPolicy.js';
const ganRule=row=>/^GAN (Sent|Reviewed|Signed|Rejected|Uploaded|Verified|Upload Returned)$/.test(row?.trigger_event||'')||/^GAN (Sent|Reviewed|Signed|Rejected|Uploaded|Verified|Upload Returned)$/.test(row?.trigger||'');
// Only the new shared GAN rule subset is restricted here; legacy rules retain their existing behavior.
export function createGanWorkflowRuleAccess(db) {
  return async(req,res,next)=>{
    if(req.params.entity!=='WorkflowRule'||req.method==='GET'||req.method==='POST'&&req.params.id==='filter')return next();
    try{
      const row=req.params.id?(await db.query('SELECT trigger,trigger_event FROM workflow_rules WHERE id::text=$1',[req.params.id])).rows[0]:null;
      if(ganRule(row)||ganRule(req.body)){const actor=await formActor(db,req.user.id);if(actor.role!=='isc_admin')throw accountError(403,'Only ISC administrators can change shared GAN notification rules');}
      next();
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to verify GAN rule access'});}
  };
}
