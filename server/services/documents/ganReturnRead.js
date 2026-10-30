import {accountError} from '../accountPolicy.js';
import {ganWorkflowAccess,assertGanRecipient} from './ganWorkflowAccess.js';
import {loadGanIssue} from './ganWorkflowIntegrity.js';
import {ganReturnParts,publicGanReturnUpload,GAN_RETURN_CHECKLIST} from './ganReturnPolicy.js';
import {verifyGanReturnUpload} from './ganReturnUploads.js';
import {ganPackageHash} from './ganPackagePolicy.js';
import {assertGanVerifier} from './ganReturnAccess.js';
export function verifyGanReturnSubmission(row) {
  if(!row||!Buffer.isBuffer(row.pdf)||ganPackageHash(row.pdf)!==row.pdf_sha256||row.manifest_sha256!==row.calculated_manifest_sha256||row.manifest.pdf_sha256!==row.pdf_sha256||row.manifest.issue_id!==row.issue_id||row.manifest.document_id!==row.document_id)throw accountError(500,'The signed submission failed its integrity check');return row;
}
export async function loadGanReturnSubmission(db,id) {
  const row=(await db.query("SELECT *,encode(sha256(convert_to(manifest::text,'UTF8')),'hex') AS calculated_manifest_sha256 FROM gan_return_submissions WHERE id::text=$1",[id])).rows[0];if(!row)throw accountError(404,'Signed submission not found');return verifyGanReturnSubmission(row);
}
export async function readGanReturnState(db,access,issue,state) {
  if(!issue||!(await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='gan_return_uploads'")).rows.length)return null;
  let verifier=true;try{assertGanVerifier(access,issue);}catch(error){if(error.status!==403)throw error;verifier=false;}
  if(access.actor.role!=='user'&&!verifier)return {parts:ganReturnParts(issue),uploads:[],submissions:[],checklist:GAN_RETURN_CHECKLIST,canUpload:false,canVerify:false};
  const uploads=(await db.query("SELECT id,issue_id,kind,version,filename,pages,source_pages,pdf_sha256,byte_size,created_at,encode(sha256(pdf),'hex') AS calculated_pdf_sha256,octet_length(pdf) AS calculated_byte_size FROM gan_return_uploads WHERE issue_id=$1 ORDER BY kind,version DESC",[issue.id] )).rows;
  if(uploads.some(row=>row.pdf_sha256!==row.calculated_pdf_sha256||row.byte_size!==row.calculated_byte_size))throw accountError(500,'The private signed upload failed its integrity check');
  const rows=(await db.query("SELECT *,encode(sha256(convert_to(manifest::text,'UTF8')),'hex') AS calculated_manifest_sha256 FROM gan_return_submissions WHERE issue_id=$1 ORDER BY submission_number DESC",[issue.id])).rows;
  rows.forEach(verifyGanReturnSubmission);
  return {parts:ganReturnParts(issue),uploads:uploads.map(publicGanReturnUpload),submissions:rows.map(row=>({id:row.id,submission_number:row.submission_number,manifest:row.manifest,pdf_sha256:row.pdf_sha256,created_at:row.created_at})),checklist:GAN_RETURN_CHECKLIST,
    canUpload:access.actor.role==='user'&&state?.issue_id===issue.id&&['Reviewed','UploadReturned'].includes(state.phase)&&issue.manifest.allowed_methods.includes('upload'),
    canVerify:verifier&&state?.issue_id===issue.id&&state.phase==='Uploaded'};
}
async function returnFileAccess(db,actorId,row) {
  const access=await ganWorkflowAccess(db,actorId,row.document_id),issue=await loadGanIssue(db,row.issue_id);
  if(access.actor.role==='user')assertGanRecipient(access,issue);else assertGanVerifier(access,issue);
  return {...access,issue};
}
export async function readGanReturnUpload(db,actorId,id) {
  const row=(await db.query('SELECT * FROM gan_return_uploads WHERE id::text=$1',[id])).rows[0];if(!row)throw accountError(404,'Signed upload not found');
  const access=await returnFileAccess(db,actorId,row);verifyGanReturnUpload(row);return {...access,upload:publicGanReturnUpload(row),pdf:row.pdf,pdf_sha256:row.pdf_sha256,filename:'signed-'+row.kind+'-v'+row.version+'.pdf'};
}
export async function readGanReturnSubmission(db,actorId,id) {
  const row=await loadGanReturnSubmission(db,id),access=await returnFileAccess(db,actorId,row);return {...access,submission:{id:row.id,submission_number:row.submission_number,manifest:row.manifest,pdf_sha256:row.pdf_sha256},pdf:row.pdf,pdf_sha256:row.pdf_sha256,filename:'signed-submission-'+row.submission_number+'.pdf'};
}
