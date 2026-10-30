import {formActor} from '../services/forms/formAccess.js';
import {readGanEntity} from '../services/documents/ganEntityRead.js';
// Activation must mount this ahead of the generic entity router.
export function createGanDocumentEntityAccess(db) {
  return async(req,res,next)=>{
    if(req.params.entity!=='GeneratedDocument')return next();
    try {
      const enabled=(await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='generated_documents' AND column_name='gan_managed'")).rows.length;
      if(!enabled)return next();
      const actor=await formActor(db,req.user.id),reading=req.method==='GET'||(req.method==='POST'&&req.params.id==='filter');
      if(reading){res.set('Cache-Control','private, no-store');return res.json(await readGanEntity(db,actor,req));}
      if(Object.keys(req.body||{}).some(key=>!/^[_a-z][_a-z0-9]*$/i.test(key)))return res.status(400).json({error:'Use valid document field names'});
      if(Object.keys(req.body||{}).some(key=>key.startsWith('gan_'))||((req.method==='POST'||req.method==='PUT')&&req.body?.doc_type==='Grant Award Notice'))return res.status(403).json({error:'Use the owned GAN workflow to create or edit an award document'});
      if(req.params.id) {
        const row=(await db.query('SELECT gan_managed FROM generated_documents WHERE id::text=$1',[req.params.id])).rows[0];
        if(row?.gan_managed)return res.status(403).json({error:'Generated GAN snapshots cannot be changed through generic record edits'});
      }
      return next();
    }catch(error){return res.status(error.status||500).json({error:error.status?error.message:'Unable to verify GAN document access'});}
  };
}
