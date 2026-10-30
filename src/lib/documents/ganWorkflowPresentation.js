export const ganPhaseLabel=phase=>({Draft:'Draft',Sent:'Sent',Reviewed:'Reviewed',RecipientSigned:'Recipient signed · awaiting NEMA',Rejected:'Rejected',Uploaded:'Uploaded · needs NEMA verification',UploadReturned:'Returned for correction',Verified:'Verified · awaiting countersignature'}[phase]||phase);
export const ganEventLabel=action=>({send:'Sent for signature',open:'Reviewed',sign:'Recipient signed',reject:'Rejected',submit_upload:'Signed documents submitted',accept_upload:'NEMA verified signed uploads',return_upload:'Returned for correction'}[action]||action);
export const ganWorkflowDate=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
export function ganSignaturePayload(form,issue){
  if(!form.name.trim()||!form.title.trim())throw new Error('Enter your full name and title.');
  const key=value=>value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
  if(key(form.name)!==key(issue.recipient_name))throw new Error('Enter the registered official name printed on this GAN: '+issue.recipient_name+'.');
  if(!form.electronic||!form.conditions||!form.authority)throw new Error('Confirm all three consent statements before signing.');
  return {name:form.name,title:form.title,consentElectronic:form.electronic,consentConditions:form.conditions,consentAuthority:form.authority,issuedPdfSha256:issue.pdf_sha256};
}
export function ganSendTokens(values={}){
  return ['application_number','subaward_number','organization_name','organization_tax_id','federal_award_number','federal_award_date','total_award_amount','authorized_official_name','gan_due_date'].map(key=>({key,value:values[key]??'—'}));
}
