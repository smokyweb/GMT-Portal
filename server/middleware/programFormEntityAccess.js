import pool from '../db/connection.js';
import {formActor} from '../services/forms/formAccess.js';
import {accountError,requireAccountAdmin} from '../services/accountPolicy.js';
export function createProgramFormEntityAccess(db=pool) {
  return async(req,res,next)=>{
    if(req.params.entity!=='GrantProgram'||req.method==='GET'||(req.method==='POST'&&req.params.id==='filter'))return next();
    try {
      requireAccountAdmin(await formActor(db,req.user.id));
      if(req.params.id) {
        const program=(await db.query('SELECT * FROM grant_programs WHERE id::text=$1',[req.params.id])).rows[0];
        if(!program)throw accountError(404,'Grant program not found');
        const used=(await db.query(`SELECT EXISTS(SELECT 1 FROM nofos WHERE program_id=$1 OR program_code=$2)
          OR EXISTS(SELECT 1 FROM grant_program_form_versions WHERE program_id::text=$1) AS used`,[program.id,program.code])).rows[0].used;
        if(used&&req.method==='DELETE')throw accountError(409,'Deactivate this grant program instead of deleting its existing forms or NOFOs');
        if(used&&req.body?.code!==undefined&&req.body.code!==program.code)throw accountError(409,'Create a new grant program to change the code after forms or NOFOs exist');
      }
      next();
    }catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to check grant program form permissions'});}
  };
}
