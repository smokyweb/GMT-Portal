import {ganReturnActions,ganReturnActionRequest} from './ganReturnPolicy.js';
import {accountError} from '../accountPolicy.js';
import {ganPackageHash} from './ganPackagePolicy.js';
export const GAN_SIGNATURE_CONSENT_VERSION='gmt-gan-electronic-v1';
export const GAN_SIGNATURE_CONSENTS={
  electronic:'I consent to use an electronic signature for this award package.',
  conditions:'I have read and accept this GAN, its Terms and Conditions and the attached Special Conditions.',
  authority:'I am authorized to accept this award for the named subrecipient organization.',
};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const ganNameKey=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
export function ganWorkflowRequest(action,input) {
  if(ganReturnActions.includes(action))return ganReturnActionRequest(action,input);
  const actions={send:['packageId'],open:[],reject:['note'],sign:['name','title','consentElectronic','consentConditions','consentAuthority','issuedPdfSha256']};
  if(!Object.hasOwn(actions,action))throw accountError(400,'Choose a supported GAN workflow action');
  const extra=actions[action];
  if(!extra||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['requestId','expectedRevision',...extra].includes(key)))throw accountError(400,'Use the requested GAN workflow fields');
  if(!uuid(input.requestId)||!Number.isInteger(input.expectedRevision)||input.expectedRevision<0)throw accountError(400,'Provide a request ID and current workflow revision');
  const result={...input,requestId:input.requestId.toLowerCase()};
  if(action==='send'&&!uuid(input.packageId))throw accountError(400,'Choose a saved GAN package');
  if(action==='send')result.packageId=input.packageId.toLowerCase();
  if(action==='reject'){result.note=typeof input.note==='string'?input.note.trim():'';if(!result.note||result.note.length>4000)throw accountError(400,'Explain the rejection in 1–4000 characters');}
  if(action==='sign'){
    for(const field of ['name','title']){result[field]=typeof input[field]==='string'?input[field].normalize('NFC').trim():'';if(!result[field]||result[field].length>160||Array.from(result[field]).some(char=>char.charCodeAt(0)<32))throw accountError(400,'Enter a valid signature '+field+' of 1–160 characters');}
    if(!['consentElectronic','consentConditions','consentAuthority'].every(key=>input[key]===true))throw accountError(400,'Confirm all three signature consent statements');
    if(typeof input.issuedPdfSha256!=='string'||!/^[a-f0-9]{64}$/.test(input.issuedPdfSha256))throw accountError(400,'Confirm the exact issued PDF being signed');
  }
  return result;
}
export function ganWorkflowFingerprint(actorId,documentId,action,input) {return ganPackageHash(JSON.stringify({actorId,documentId,action,input:Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)))}));}
export function publicGanIssue(row) {
  return {id:row.id,document_id:row.document_id,package_id:row.package_id,gan_revision:row.gan_revision,recipient_id:row.recipient_id,recipient_name:row.manifest.recipient.name,
    approving_official_id:row.approver_id,pages:row.manifest.pages,pdf_sha256:row.pdf_sha256,issued_at:row.issued_at,allowed_methods:row.manifest.allowed_methods,fullyExecuted:false};
}
