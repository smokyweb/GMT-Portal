import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {formActor,formNofo,assertFormAdmin,auditForm} from '../forms/formAccess.js';
import {ganAttachmentInput,ganPackageFingerprint,ganPackageHash,publicGanAttachment} from './ganPackagePolicy.js';
import {inspectGanAttachmentPdf} from './pdf/ganAttachmentPdf.js';
export async function ganAttachmentAccess(db,actorId,nofoId) {
  const actor=await formActor(db,actorId),nofo=await formNofo(db,nofoId);assertFormAdmin(actor,nofo);return {actor,nofo};
}
export async function listGanAttachments(db,actorId,nofoId) {
  await ganAttachmentAccess(db,actorId,nofoId);
  return (await db.query('SELECT id,nofo_id,kind,title,version,pages,signature_pages,pdf_sha256,byte_size,actor_id,created_at FROM gan_attachment_sources WHERE nofo_id=$1 ORDER BY kind,version DESC',[nofoId])).rows.map(publicGanAttachment);
}
export function verifyGanAttachment(row) {
  if(!row||!Buffer.isBuffer(row.pdf)||ganPackageHash(row.pdf)!==row.pdf_sha256||row.byte_size!==row.pdf.length)throw accountError(500,'The saved attachment failed its integrity check');
  return row;
}
export async function saveGanAttachment(pool,actorId,nofoId,input,pdf,ip='') {
  const request=ganAttachmentInput(input),db=await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const {actor}=await ganAttachmentAccess(db,actorId,nofoId);
    const inspected=await inspectGanAttachmentPdf(pdf,request.signaturePages),hash=ganPackageHash(pdf),fingerprint=ganPackageFingerprint(actorId,nofoId,request,{pdf:hash});
    await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':gan-attachment:'||$1))",[nofoId]);
    const replay=(await db.query('SELECT * FROM gan_attachment_sources WHERE nofo_id=$1 AND request_id=$2',[nofoId,request.requestId])).rows[0];
    if(replay){if(replay.request_sha256!==fingerprint)throw accountError(409,'This upload request ID was used for a different attachment');verifyGanAttachment(replay);await db.query('COMMIT');return {attachment:publicGanAttachment(replay),replayed:true};}
    const version=Number((await db.query('SELECT COALESCE(MAX(version),0)+1 AS n FROM gan_attachment_sources WHERE nofo_id=$1 AND kind=$2',[nofoId,request.kind])).rows[0].n);
    await db.query("SELECT set_config('gmt.gan_package_action','attachment',true)");
    const row=(await db.query(`INSERT INTO gan_attachment_sources(id,nofo_id,kind,title,version,pages,signature_pages,pdf,pdf_sha256,byte_size,actor_id,request_id,request_sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[randomUUID(),nofoId,request.kind,request.title,version,inspected.pages,JSON.stringify(request.signaturePages),pdf,hash,inspected.bytes,actor.id,request.requestId,fingerprint])).rows[0];
    await auditForm(db,actor,row.id,'GANAttachmentVersionCreated',request.kind+' v'+version+'; PDF SHA-256 '+hash+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocumentAttachment');
    await db.query('COMMIT');return {attachment:publicGanAttachment(row),replayed:false};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'Attachment versions changed concurrently. Retry the same request.');throw error;}finally{db.release();}
}
export async function readGanAttachment(db,actorId,id) {
  const row=(await db.query('SELECT * FROM gan_attachment_sources WHERE id::text=$1',[id])).rows[0];if(!row)throw accountError(404,'GAN attachment not found');
  const access=await ganAttachmentAccess(db,actorId,row.nofo_id);verifyGanAttachment(row);return {...access,attachment:publicGanAttachment(row),pdf:row.pdf};
}
