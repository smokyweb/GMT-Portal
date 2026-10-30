import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
export const ganPackageHash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function fields(input,allowed) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw accountError(400,'Use only the GAN attachment/package fields');
  if(!uuid(input.requestId))throw accountError(400,'Provide a valid request ID');
}
export function ganAttachmentInput(input) {
  fields(input,['requestId','kind','title','signaturePages']);
  if(!['special_conditions','direct_deposit'].includes(input.kind))throw accountError(400,'Choose Special Conditions or a blank Direct Deposit form');
  const title=typeof input.title==='string'?input.title.trim():'';
  if(!title||title.length>160||Array.from(title).some(char=>char.charCodeAt(0)<32))throw accountError(400,'Enter a title of 1–160 characters');
  const pages=input.signaturePages??[];
  if(!Array.isArray(pages)||pages.length>150||pages.some(page=>!Number.isInteger(page)||page<1)||new Set(pages).size!==pages.length)throw accountError(400,'List distinct, one-based signature page numbers');
  if(input.kind==='special_conditions'&&!pages.length)throw accountError(400,'Identify the Special Conditions signature pages');
  return {requestId:input.requestId.toLowerCase(),kind:input.kind,title,signaturePages:[...pages].sort((a,b)=>a-b)};
}
export function ganPackageInput(input) {
  fields(input,['requestId','expectedGanRevision','expectedPackageRevision','conditionsId','depositId']);
  for(const key of ['expectedGanRevision','expectedPackageRevision'])if(!Number.isInteger(input[key])||input[key]<(key==='expectedGanRevision'?1:0))throw accountError(400,'Provide the current GAN and package revisions');
  if(!uuid(input.conditionsId)||input.depositId!=null&&!uuid(input.depositId))throw accountError(400,'Select saved Special Conditions and, optionally, a Direct Deposit form');
  return {...input,requestId:input.requestId.toLowerCase(),conditionsId:input.conditionsId.toLowerCase(),depositId:input.depositId?.toLowerCase()||null};
}
export function ganPackageFingerprint(actorId,id,input,extra={}) {
  return ganPackageHash(JSON.stringify({actorId,id,input:Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b))),...extra}));
}
export const publicGanAttachment=row=>({id:row.id,nofo_id:row.nofo_id,kind:row.kind,title:row.title,version:row.version,pages:row.pages,signature_pages:row.signature_pages,pdf_sha256:row.pdf_sha256,bytes:row.byte_size,created_by:row.actor_id,created_at:row.created_at});
export const publicGanPackage=row=>({id:row.id,document_id:row.document_id,gan_revision:row.gan_revision,package_revision:row.package_revision,pdf_sha256:row.pdf_sha256,manifest_sha256:row.manifest_sha256,pages:row.manifest?.pages,created_at:row.created_at,previewOnly:true,readyForSending:false});
