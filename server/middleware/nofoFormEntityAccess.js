import pool from '../db/connection.js';
import {formActor} from '../services/forms/formAccess.js';
import {validateNofoMutation} from '../services/forms/nofoRecordPolicy.js';
export function createNofoFormEntityAccess(db=pool) {
  return async(req,res,next)=>{
    if(req.params.entity!=='Nofo'||req.method==='GET'||(req.method==='POST'&&req.params.id==='filter'))return next();
    try {req.body=await validateNofoMutation(db,await formActor(db,req.user.id),req.params.id,req.body,req.method);next();}
    catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to check NOFO form permissions'});}
  };
}
