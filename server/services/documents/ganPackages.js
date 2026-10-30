import {readGanPackage} from './ganPackageRead.js';
import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {managedGanDocument} from './ganDraftAccess.js';
import {readGanDraft} from './ganDraftRead.js';
import {verifyGanAttachment} from './ganAttachments.js';
import {ganPackageInput,ganPackageFingerprint,ganPackageHash,publicGanPackage} from './ganPackagePolicy.js';
import {renderGanPackagePreview} from './pdf/ganPackagePdf.js';
export async function saveGanPackage(pool,actorId,id,input,ip='') {
  const request=ganPackageInput(input),fingerprint=ganPackageFingerprint(actorId,id,request),db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const {actor,document,application}=await managedGanDocument(db,actorId,id);
    if(!['admin','isc_admin'].includes(actor.role))throw accountError(403,'An assigned administrator must prepare award packages');
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':gan-package:'||$1))",[id]);
    const replay=(await db.query('SELECT * FROM gan_package_snapshots WHERE document_id=$1 AND request_id=$2',[id,request.requestId])).rows[0];
    if(replay){if(replay.request_sha256!==fingerprint)throw accountError(409,'This package request ID was used for different selections');const checked=await readGanPackage(db,actorId,replay.id);await db.query('COMMIT');return {package:checked.package,replayed:true};}
    if(!['Draft','Rejected'].includes(document.status))throw accountError(409,'A sent GAN keeps its recorded package');
    if(document.gan_revision!==request.expectedGanRevision)throw accountError(409,'The GAN revision changed. Reload its package choices.');
    const revision=Number((await db.query('SELECT COALESCE(MAX(package_revision),0) AS n FROM gan_package_snapshots WHERE document_id=$1',[id])).rows[0].n);
    if(revision!==request.expectedPackageRevision)throw accountError(409,'The package changed. Reload before preparing another version.');
    const attachments=[];
    for(const [kind,sourceId] of [['special_conditions',request.conditionsId],['direct_deposit',request.depositId]])if(sourceId) {
      const source=(await db.query('SELECT * FROM gan_attachment_sources WHERE id=$1',[sourceId])).rows[0];
      if(!source||source.nofo_id!==application.nofo_id||source.kind!==kind)throw accountError(403,'Choose the correct attachment type from this GAN’s NOFO');
      attachments.push(verifyGanAttachment(source));
    }
    const gan=await readGanDraft(db,actorId,id,request.expectedGanRevision),rendered=await renderGanPackagePreview(gan,attachments),hash=ganPackageHash(rendered.pdf);
    const manifest={schema_version:1,kind:'draft_package',document_id:id,application_id:document.application_id,organization_id:document.organization_id,nofo_id:application.nofo_id,
      application_number:document.application_number,subaward_number:gan.snapshot.values.subaward_number,project_ids:gan.snapshot.projects.map(p=>p.project_id),
      gan_revision:document.gan_revision,gan_pdf_sha256:gan.document.pdf_sha256,template_id:gan.snapshot.template_id,template_version:gan.snapshot.template_version,
      pages:rendered.pages,parts:rendered.parts,pdf_sha256:hash,required_returns:rendered.parts.filter(p=>p.kind!=='direct_deposit').map(p=>({kind:p.kind,package_signature_pages:p.signature_pages})),ready_for_sending:false};
    await db.query("SELECT set_config('gmt.gan_package_action','package',true)");
    const row=(await db.query(`INSERT INTO gan_package_snapshots(id,document_id,application_id,organization_id,gan_revision,package_revision,manifest,manifest_sha256,pdf,pdf_sha256,actor_id,request_id,request_sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7,encode(sha256(convert_to($7::jsonb::text,'UTF8')),'hex'),$8,$9,$10,$11,$12) RETURNING *`,
      [randomUUID(),id,document.application_id,document.organization_id,document.gan_revision,revision+1,JSON.stringify(manifest),rendered.pdf,hash,actor.id,request.requestId,fingerprint])).rows[0];
    await auditForm(db,actor,row.id,'GANDraftPackagePrepared','GAN r'+document.gan_revision+'; package r'+(revision+1)+'; PDF SHA-256 '+hash+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocument');
    await db.query('COMMIT');return {package:publicGanPackage(row),replayed:false};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'The GAN/package sources changed concurrently. Reload and retry the same request.');throw error;}finally{db.release();}
}
