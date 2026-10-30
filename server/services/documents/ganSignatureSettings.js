import {accountError} from '../accountPolicy.js';
import {formActor,auditForm} from '../forms/formAccess.js';
export async function ganSignatureSettings(db,templateId) {
  if(!(await db.query("SELECT id FROM document_templates WHERE id::text=$1 AND doc_type='Grant Award Notice'",[templateId])).rows.length)throw accountError(404,'GAN template not found');
  const row=(await db.query('SELECT * FROM gan_signature_settings WHERE template_id::text=$1',[templateId])).rows[0];
  return row?{template_id:templateId,revision:row.revision,allowed_methods:row.allowed_methods}:{template_id:templateId,revision:0,allowed_methods:['electronic','upload']};
}
export async function saveGanSignatureSettings(pool,actorId,templateId,input) {
  if(!input||Object.keys(input).some(key=>!['expectedRevision','allowedMethods'].includes(key))||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0||
    !Array.isArray(input.allowedMethods)||!input.allowedMethods.length||input.allowedMethods.length>2||input.allowedMethods.some(method=>!['electronic','upload'].includes(method))||new Set(input.allowedMethods).size!==input.allowedMethods.length)throw accountError(400,'Choose electronic signature, print/upload, or both, with the current settings revision');
  const db=await pool.connect();try{
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const actor=await formActor(db,actorId);if(actor.role!=='isc_admin')throw accountError(403,'An ISC administrator manages shared template signing settings');
    const template=(await db.query("SELECT id FROM document_templates WHERE id::text=$1 AND doc_type='Grant Award Notice' FOR UPDATE",[templateId])).rows[0];if(!template)throw accountError(404,'GAN template not found');
    const before=await ganSignatureSettings(db,templateId);if(before.revision!==input.expectedRevision)throw accountError(409,'Template signing settings changed. Reload them.');
    await db.query("SELECT set_config('gmt.gan_action','workflow_settings',true)");
    await db.query('INSERT INTO gan_signature_settings(template_id,revision,allowed_methods,actor_id) VALUES($1,1,$2,$3) ON CONFLICT(template_id) DO UPDATE SET revision=gan_signature_settings.revision+1,allowed_methods=EXCLUDED.allowed_methods,actor_id=EXCLUDED.actor_id,updated_at=NOW()',[templateId,[...input.allowedMethods].sort(),actor.id]);
    await auditForm(db,actor,templateId,'GANSigningSettingsUpdated','Allowed methods: '+input.allowedMethods.join(', '),'DocumentTemplate');
    const saved=await ganSignatureSettings(db,templateId);await db.query('COMMIT');return saved;
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01'].includes(error.code))throw accountError(409,'Template settings changed concurrently. Reload them.');throw error;}finally{db.release();}
}
