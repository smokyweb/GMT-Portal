import {accountError} from '../accountPolicy.js';
import {ganNameKey} from './ganWorkflowPolicy.js';
export const GAN_RETURN_CHECKLIST={
  awardNumberAmount:'Award number and amount match the generated GAN',
  projectAmounts:'Project amounts match every project on the issued GAN and Schedule',
  authorizedSignature:'Block 10 is signed by the authorized official',
  taxIdDate:'Blocks 11 and 12 are complete',
  conditionsIncluded:'All required Special Conditions signature pages are included',
  termsUnchanged:'No changes were made to the award terms',
};
export const ganReturnActions=['submit_upload','accept_upload','return_upload'];
export const ganReturnUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function ganReturnParts(issue) {
  return issue.manifest.parts.map(part=>({kind:part.kind,title:part.title,pages:part.page_end-part.page_start+1,
    required:part.kind!=='direct_deposit',signaturePages:part.signature_pages.map(page=>page-part.page_start+1)}));
}
const text=(value,label,max=160)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max||Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))throw accountError(400,'Enter a valid '+label);return value.normalize('NFC').trim();};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function ganReturnActionRequest(action,input) {
  const extras=action==='submit_upload'?['uploadIds','name','title','signedDate','confirmed','issuedPdfSha256']:['submissionId','issuedPdfSha256','uploadedPdfSha256',...(action==='accept_upload'?['checklist','note']:['note'])];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['requestId','expectedRevision',...extras].includes(key)))throw accountError(400,'Use the requested signed-return fields');
  if(!ganReturnUuid(input.requestId)||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0||!sha(input.issuedPdfSha256))throw accountError(400,'Provide a request ID, current workflow revision and issued PDF hash');
  const request={...input,requestId:input.requestId.toLowerCase()};
  if(action==='submit_upload'){
    if(!Array.isArray(input.uploadIds)||input.uploadIds.length<2||input.uploadIds.length>3||!input.uploadIds.every(ganReturnUuid)||new Set(input.uploadIds.map(id=>id.toLowerCase())).size!==input.uploadIds.length)throw accountError(400,'Choose distinct signed GAN and Special Conditions uploads');
    request.uploadIds=input.uploadIds.map(id=>id.toLowerCase()).sort();request.name=text(input.name,'signer name');request.title=text(input.title,'signer title');
    if(input.confirmed!==true)throw accountError(400,'Confirm these are the complete signed award documents');
    if(typeof input.signedDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.signedDate)||!Number.isFinite(Date.parse(input.signedDate+'T00:00:00Z'))||new Date(input.signedDate+'T00:00:00Z').toISOString().slice(0,10)!==input.signedDate)throw accountError(400,'Enter a valid date signed');
  }else{
    if(!ganReturnUuid(input.submissionId)||!sha(input.uploadedPdfSha256))throw accountError(400,'Choose the exact submitted copy being verified');
    request.submissionId=input.submissionId.toLowerCase();
    if(action==='return_upload')request.note=text(input.note,'correction note of 1–4000 characters',4000);
    else{
      const keys=Object.keys(GAN_RETURN_CHECKLIST);
      if(!input.checklist||typeof input.checklist!=='object'||Array.isArray(input.checklist)||Object.keys(input.checklist).length!==keys.length||!keys.every(key=>input.checklist[key]===true))throw accountError(400,'Complete all six NEMA verification checks');
      request.note=input.note==null||input.note===''?'':text(input.note,'verification note',4000);
    }
  }
  return request;
}
export function assertGanReturnSigner(request,issue,now) {
  if(ganNameKey(request.name)!==ganNameKey(issue.manifest.recipient.name))throw accountError(400,'Use the registered authorized official name printed on the issued GAN');
  if(request.signedDate>now.slice(0,10)||request.signedDate<issue.manifest.gan.award_date)throw accountError(400,'The date signed must be between the GAN award date and today');
}
export function publicGanReturnUpload(row) {
  return {id:row.id,issue_id:row.issue_id,kind:row.kind,version:row.version,filename:row.filename,pages:row.pages,source_pages:row.source_pages,pdf_sha256:row.pdf_sha256,byte_size:row.byte_size,created_at:row.created_at};
}
