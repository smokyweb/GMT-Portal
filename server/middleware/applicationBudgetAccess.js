import pool from '../db/connection.js';
import {formActor,assertApplicationAccess} from '../services/forms/formAccess.js';
import {moneyCents} from '../services/forms/valueValidation.js';
import {accountError} from '../services/accountPolicy.js';
export function createApplicationBudgetAccess(db=pool) {
  return async(req,res,next)=>{
    if(req.params.entity!=='ApplicationBudget'||req.method==='GET'||(req.method==='POST'&&req.params.id==='filter'))return next();
    try {
      const actor=await formActor(db,req.user.id);
      if(req.body?.ehp_affected!==undefined)throw accountError(403,'Use the EHP review panel to classify affected budget lines');
      let previous;if(req.params.id)previous=(await db.query('SELECT * FROM application_budgets WHERE id::text=$1',[req.params.id])).rows[0];
      if(req.params.id&&!previous)throw accountError(404,'Budget line not found');
      const applicationId=previous?.application_id||req.body?.application_id;
      if(previous&&req.body?.application_id&&req.body.application_id!==previous.application_id)throw accountError(400,'A budget line cannot be moved to another application');
      const application=(await db.query('SELECT * FROM applications WHERE id::text=$1',[applicationId])).rows[0];
      if(!application)throw accountError(404,'Application not found');
      const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
      assertApplicationAccess(actor,application,organization,true);
      if(req.body?.project_id&&(await db.query('SELECT id FROM projects WHERE id::text=$1 AND application_id=$2',[req.body.project_id,application.id])).rows.length===0)throw accountError(400,'Choose a project from this application');
      for(const key of ['amount_requested','amount_match'])if(req.body?.[key]!==undefined&&moneyCents(req.body[key])===null)throw accountError(400,'Budget amounts must be nonnegative with at most two decimals');
      if(actor.role==='user') {
        const allowed=['application_id','project_id','budget_category','line_description','amount_requested','amount_match','is_allowable'];
        if(Object.keys(req.body||{}).some(key=>!allowed.includes(key)))throw accountError(403,'Only a reviewer can change budget review fields');
        if(req.body?.is_allowable!==undefined)delete req.body.is_allowable;
      }
      next();
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to check application budget permissions'});}
  };
}
