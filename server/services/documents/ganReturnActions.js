import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {assertGanRecipient} from './ganWorkflowAccess.js';
import {assertGanVerifier} from './ganReturnAccess.js';
import {ganReturnParts,assertGanReturnSigner} from './ganReturnPolicy.js';
import {verifyGanReturnUpload} from './ganReturnUploads.js';
import {loadGanReturnSubmission} from './ganReturnRead.js';
import {renderGanReturnPdf} from './pdf/ganReturnPdf.js';
export async function prepareGanReturnAction(db,access,issue,state,action,request,now) {
  if(issue.id!==state.issue_id||access.document.status==='Draft')throw accountError(409,'Use the current issued package');
  if(request.issuedPdfSha256!==issue.pdf_sha256)throw accountError(409,'The generated GAN does not match the issued copy being verified');
  if(action==='submit_upload'){
    assertGanRecipient(access,issue);
    if(!issue.manifest.allowed_methods.includes('upload'))throw accountError(403,'This issued template allows electronic signing only');
    if(!['Reviewed','UploadReturned'].includes(state.phase))throw accountError(409,'Review the issued package or wait for a return before resubmitting');
    assertGanReturnSigner(request,issue,now);
    const uploads=(await db.query('SELECT * FROM gan_return_uploads WHERE id=ANY($1::uuid[])',[request.uploadIds])).rows;
    if(uploads.length!==request.uploadIds.length||uploads.some(row=>row.issue_id!==issue.id||row.actor_id!==access.actor.id))throw accountError(403,'Choose your own signed uploads for this issued GAN');
    const parts=ganReturnParts(issue),required=parts.filter(part=>part.required);
    if(required.some(part=>!uploads.some(row=>row.kind===part.kind))||new Set(uploads.map(row=>row.kind)).size!==uploads.length)throw accountError(422,'Upload the signed GAN and every required Special Conditions signature page');
    for(const upload of uploads){
      verifyGanReturnUpload(upload);const part=parts.find(part=>part.kind===upload.kind);
      if(!part||part.signaturePages.some(page=>!upload.source_pages.includes(page)))throw accountError(422,'A required signature page is missing from '+upload.kind);
      const latest=(await db.query('SELECT MAX(version)::int AS version FROM gan_return_uploads WHERE issue_id=$1 AND kind=$2',[issue.id,upload.kind])).rows[0].version;
      if(upload.version!==latest)throw accountError(409,'Choose the latest uploaded version for '+upload.kind);
    }
    uploads.sort((a,b)=>parts.findIndex(part=>part.kind===a.kind)-parts.findIndex(part=>part.kind===b.kind));
    const artifact=await renderGanReturnPdf(uploads),id=randomUUID(),number=(await db.query('SELECT COALESCE(MAX(submission_number),0)+1 AS n FROM gan_return_submissions WHERE issue_id=$1',[issue.id])).rows[0].n;
    const manifest={schema_version:1,kind:'signed_upload_submission',id,document_id:access.document.id,issue_id:issue.id,issued_pdf_sha256:issue.pdf_sha256,pdf_sha256:artifact.pdf_sha256,pages:artifact.pages,parts:artifact.parts,
      recipient:{id:access.actor.id,email:access.actor.email,name:request.name,title:request.title,signed_date:request.signedDate,received_at:now},confirmed:true,
      uploads:uploads.map(row=>({id:row.id,kind:row.kind,version:row.version,pdf_sha256:row.pdf_sha256,source_pages:row.source_pages,pages:row.pages}))};
    await db.query(`INSERT INTO gan_return_submissions(id,document_id,issue_id,submission_number,actor_id,manifest,manifest_sha256,pdf,pdf_sha256,created_at)
      VALUES($1,$2,$3,$4,$5,$6,encode(sha256(convert_to($6::jsonb::text,'UTF8')),'hex'),$7,$8,$9)`,[id,access.document.id,issue.id,number,access.actor.id,JSON.stringify(manifest),artifact.pdf,artifact.pdf_sha256,now]);
    return {phase:'Uploaded',evidence:{submissionId:id,submissionNumber:number,issuedPdfSha256:issue.pdf_sha256,uploadedPdfSha256:artifact.pdf_sha256,recipient:manifest.recipient,confirmed:true,uploadIds:uploads.map(row=>row.id)},artifact};
  }
  assertGanVerifier(access,issue);if(state.phase!=='Uploaded')throw accountError(409,'Only an uploaded copy awaiting verification can be accepted or returned');
  const submission=await loadGanReturnSubmission(db,request.submissionId),latest=(await db.query('SELECT id FROM gan_return_submissions WHERE issue_id=$1 ORDER BY submission_number DESC LIMIT 1',[issue.id])).rows[0];
  if(submission.issue_id!==issue.id||latest?.id!==submission.id||submission.pdf_sha256!==request.uploadedPdfSha256)throw accountError(409,'Review the exact current uploaded copy before verifying it');
  const evidence={submissionId:submission.id,issuedPdfSha256:issue.pdf_sha256,uploadedPdfSha256:submission.pdf_sha256,note:request.note,recipient:submission.manifest.recipient,...(action==='accept_upload'?{checklist:request.checklist}:{})};
  return {phase:action==='accept_upload'?'Verified':'UploadReturned',evidence,artifact:null};
}
