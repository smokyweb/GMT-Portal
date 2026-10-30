import {accountError} from '../accountPolicy.js';
import {formActor,assertApplicationAccess,assertNofoAccess} from '../forms/formAccess.js';
export async function ganDraftAccess(db,actorId,applicationId,adminOnly=false) {
  const actor=await formActor(db,actorId);
  if(adminOnly&&!['admin','isc_admin'].includes(actor.role))throw accountError(403,'An assigned administrator must generate GAN drafts');
  const application=(await db.query('SELECT * FROM applications WHERE id::text=$1',[applicationId])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
  if(!organization)throw accountError(409,'Restore the GAN recipient organization before continuing');
  assertApplicationAccess(actor,application,organization);
  const nofo=(await db.query('SELECT * FROM nofos WHERE id::text=$1',[application.nofo_id])).rows[0];
  if(nofo)assertNofoAccess(actor,nofo,organization);
  return {actor,application,organization};
}
export async function managedGanDocument(db,actorId,id) {
  const document=(await db.query('SELECT * FROM generated_documents WHERE id::text=$1 AND gan_managed',[id])).rows[0];
  if(!document)throw accountError(404,'GAN document not found');
  const access=await ganDraftAccess(db,actorId,document.application_id);
  if(document.organization_id!==access.application.organization_id)throw accountError(409,'This GAN retains its original organization; reconcile the changed application assignment');
  // Unsent drafts are visible only to administrators.
  if(document.status==='Draft'&&!['admin','isc_admin'].includes(access.actor.role))throw accountError(403,'This GAN draft has not been sent to you');
  if(!['admin','isc_admin'].includes(access.actor.role)&&(await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='gan_workflows'")).rows.length&&
    (await db.query('SELECT 1 FROM gan_workflows WHERE document_id=$1',[document.id])).rows.length)throw accountError(403,'Use the issued GAN package to review or download this award');
  return {...access,document};
}
