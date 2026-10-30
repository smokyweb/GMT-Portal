import {accountError} from '../services/accountPolicy.js';
import {formActor} from '../services/forms/formAccess.js';
import {ganOrganizationSettingsAccess} from '../services/documents/ganSettingsAccess.js';
const protectedFields={Organization:['authorized_official_id','grantee_id','gan_settings_revision'],Grantee:['contact_title','approving_official_id','approving_official_name','approving_official_title','gan_settings_revision']};
const sourceFields=['name','agency_name','contact_name','contact_email','contact_phone','is_active'];
export function createGanSettingsEntityAccess(db) {
  return async(req,res,next)=>{
    const fields=protectedFields[req.params.entity],writing=['PUT','DELETE'].includes(req.method)||req.method==='POST'&&req.params.id!=='filter';
    if(!fields||!writing)return next();
    try {
      const table=req.params.entity==='Organization'?'organizations':'grantees';
      if(!(await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name='gan_settings_revision'",[table])).rows.length)return next();
      const actor=await formActor(db,req.user.id),data=req.body||{};
      if(Object.keys(data).some(key=>!/^[_a-z][_a-z0-9]*$/.test(key)))throw accountError(400,'Use valid organization or grantee field names');
      const row=req.params.id?(await db.query('SELECT * FROM '+table+' WHERE id::text=$1',[req.params.id])).rows[0]:null;
      if(req.params.entity==='Grantee') {
        if(actor.role!=='isc_admin')throw accountError(403,'Use your scoped Grantee award settings panel for contact changes');
        if(row&&req.method==='PUT'&&sourceFields.some(key=>data[key]!==undefined&&data[key]!==row[key])&&data.gan_settings_revision!==row.gan_settings_revision)throw accountError(409,'Grantee source settings changed. Reload the grantee editor before saving.');
      }
      if(req.params.entity==='Organization'&&row&&fields.some(key=>data[key]!==undefined))await ganOrganizationSettingsAccess(db,actor.id,row.id,true);
      for(const key of fields)if(Object.hasOwn(data,key)) {
        if(!row&&(key==='gan_settings_revision'?Number(data[key])!==0:data[key]!=null&&data[key]!==''))throw accountError(403,'Use the owned award-contact settings workflow');
        if(row&&(key==='gan_settings_revision'?data[key]!==row[key]:String(data[key]??'')!==String(row[key]??'')))throw accountError(key==='gan_settings_revision'?409:403,'Award-contact settings changed. Use the dedicated settings panel or reload this editor.');
        delete data[key];
      }
      return next();
    }catch(error){return res.status(error.status||500).json({error:error.status?error.message:'Unable to verify award-contact settings access'});}
  };
}
