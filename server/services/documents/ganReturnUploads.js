import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ganWorkflowAccess,assertGanRecipient} from './ganWorkflowAccess.js';
import {currentGanReturnIssue} from './ganReturnAccess.js';
import {ganReturnParts,ganReturnUuid,publicGanReturnUpload} from './ganReturnPolicy.js';
import {ganPackageHash,ganPackageFingerprint} from './ganPackagePolicy.js';
import {inspectGanReturnPdf} from './pdf/ganReturnPdf.js';
export function ganReturnUploadRequest(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['requestId','expectedRevision','kind','sourcePages'].includes(key)))throw accountError(400,'Use the requested signed-upload fields');
  const request={...input};
  if(!ganReturnUuid(input.requestId)||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0||!['gan','special_conditions','direct_deposit'].includes(input.kind))throw accountError(400,'Choose a return type, request ID and current workflow revision');
  if(!Array.isArray(input.sourcePages)||!input.sourcePages.length||input.sourcePages.length>150||input.sourcePages.some(page=>!Number.isInteger(page)||page<1)||new Set(input.sourcePages).size!==input.sourcePages.length)throw accountError(400,'Identify the distinct original pages included in this PDF');
  request.requestId=input.requestId.toLowerCase();request.sourcePages=[...input.sourcePages];return request;
}
export function verifyGanReturnUpload(row) {
  if(!row||!Buffer.isBuffer(row.pdf)||ganPackageHash(row.pdf)!==row.pdf_sha256||row.pdf.length!==row.byte_size)throw accountError(500,'The private signed upload failed its integrity check');return row;
}
export async function saveGanReturnUpload(pool,actorId,documentId,input,pdf,filename,ip='') {
  const request=ganReturnUploadRequest(input),db=await pool.connect();
  try{
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const access=await ganWorkflowAccess(db,actorId,documentId,{lock:true}),{state,issue}=await currentGanReturnIssue(db,access);
    assertGanRecipient(access,issue);
    if(!issue.manifest.allowed_methods.includes('upload'))throw accountError(403,'This issued template allows electronic signing only');
    const inspected=await inspectGanReturnPdf(pdf),hash=ganPackageHash(pdf),safeName=Array.from(String(filename||'signed-pages.pdf').split(/[\\/]/).pop()).filter(char=>char.charCodeAt(0)>=32&&char.charCodeAt(0)!==127).join('').slice(0,180)||'signed-pages.pdf';
    const fingerprint=ganPackageFingerprint(actorId,issue.id,request,{pdf:hash,filename:safeName});
    const replay=(await db.query('SELECT * FROM gan_return_uploads WHERE issue_id=$1 AND request_id=$2',[issue.id,request.requestId])).rows[0];
    if(replay){if(replay.request_sha256!==fingerprint)throw accountError(409,'This upload request ID was used for a different signed file');verifyGanReturnUpload(replay);await db.query('COMMIT');return {upload:publicGanReturnUpload(replay),replayed:true};}
    if(!['Reviewed','UploadReturned'].includes(state.phase))throw accountError(409,'Wait for NEMA to return a submitted copy before replacing it');
    if(request.expectedRevision!==state.revision)throw accountError(409,'The GAN workflow changed. Reload before uploading.');
    const part=ganReturnParts(issue).find(part=>part.kind===request.kind);if(!part)throw accountError(400,'This return type is not in the issued package');
    if(inspected.pages!==request.sourcePages.length||request.sourcePages.some(page=>page>part.pages))throw accountError(422,'List one original page number for each uploaded PDF page, within this issued document');
    const version=Number((await db.query('SELECT COALESCE(MAX(version),0)+1 AS n FROM gan_return_uploads WHERE issue_id=$1 AND kind=$2',[issue.id,request.kind])).rows[0].n);
    await db.query("SELECT set_config('gmt.gan_action','return_upload',true)");
    const row=(await db.query(`INSERT INTO gan_return_uploads(id,document_id,issue_id,kind,version,workflow_revision,actor_id,filename,pages,source_pages,pdf,pdf_sha256,byte_size,request_id,request_sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,[randomUUID(),access.document.id,issue.id,request.kind,version,state.revision,access.actor.id,safeName,inspected.pages,JSON.stringify(request.sourcePages),pdf,hash,pdf.length,request.requestId,fingerprint])).rows[0];
    await auditForm(db,access.actor,access.document.id,'GANSignedPagesUploaded',request.kind+' v'+version+'; issue '+issue.id+'; upload '+row.id+'; SHA-256 '+hash+'; observed IP: '+String(ip).slice(0,100),'GeneratedDocument');
    await db.query('COMMIT');return {upload:publicGanReturnUpload(row),replayed:false};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'Signed returns changed concurrently. Reload and retry the same request.');throw error;}finally{db.release();}
}
