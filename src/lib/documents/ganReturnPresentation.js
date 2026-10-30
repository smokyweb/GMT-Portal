export const ganReturnTitle=kind=>({gan:'Signed GAN',special_conditions:'Special Conditions signature pages',direct_deposit:'Direct Deposit'}[kind]||kind);
export const ganReturnInputLabel=kind=>ganReturnTitle(kind)+' PDF';
export function ganReturnPageNumbers(text) {
  const pages=text.split(',').map(item=>Number(item.trim()));
  if(!text.trim()||pages.some(page=>!Number.isInteger(page)||page<1)||new Set(pages).size!==pages.length)throw new Error('List distinct original page numbers separated by commas.');
  return pages;
}
export function latestGanReturnUploads(returns) {
  return (returns?.parts||[]).map(part=>({part,upload:returns.uploads.find(upload=>upload.kind===part.kind)}));
}
export function ganReturnMissing(returns) {
  return latestGanReturnUploads(returns).filter(({part,upload})=>part.required&&(!upload||part.signaturePages.some(page=>!upload.source_pages.includes(page)))).map(({part})=>ganReturnTitle(part.kind));
}
export function ganReturnSubmitPayload(form,record) {
  const missing=ganReturnMissing(record.returns);if(missing.length)throw new Error('Complete the required uploads: '+missing.join(', ')+'.');
  if(!form.name.trim()||!form.title.trim()||!form.signedDate)throw new Error('Enter the signer name, title and date signed.');
  if(!form.confirmed)throw new Error('Confirm that these are the complete signed documents.');
  return {uploadIds:latestGanReturnUploads(record.returns).filter(item=>item.upload).map(item=>item.upload.id),name:form.name,title:form.title,signedDate:form.signedDate,confirmed:form.confirmed,issuedPdfSha256:record.issue.pdf_sha256};
}
export function ganVerificationPayload(record,form,returning) {
  const submission=record.returns.submissions[0];if(!submission)throw new Error('Load the current signed submission.');
  if(returning&&!form.note.trim())throw new Error('Explain what the recipient needs to correct.');
  if(!returning&&!Object.keys(record.returns.checklist).every(key=>form.checklist[key]===true))throw new Error('Complete all six verification checks.');
  return {submissionId:submission.id,issuedPdfSha256:record.issue.pdf_sha256,uploadedPdfSha256:submission.pdf_sha256,note:form.note,...(!returning?{checklist:form.checklist}:{})};
}
export const ganReturnActionNotice=action=>({submit_upload:'Signed documents submitted. NEMA verification is required before countersignature.',accept_upload:'Signed uploads verified. Assistant Director countersignature is still required.',return_upload:'Returned for correction. The recipient can replace and resubmit their signed pages.'}[action]);
