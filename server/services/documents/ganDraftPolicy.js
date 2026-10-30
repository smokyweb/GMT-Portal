import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {ganContextOptions} from './ganContextPolicy.js';
export function ganDraftRequest(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw accountError(400,'Choose the saved GAN source records');
  const {requestId,expectedRevision,...options}=input;
  if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw accountError(400,'Provide a new draft request ID');
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw accountError(400,'Provide the current GAN revision');
  ganContextOptions(options);
  if(!options.templateId)throw accountError(400,'Select a saved template before generating a draft');
  return {requestId,expectedRevision,options};
}
export function ganDraftRequestHash(actorId,applicationId,request) {
  const selected=Object.fromEntries(Object.entries(request.options).sort(([a],[b])=>a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify({actorId,applicationId,expectedRevision:request.expectedRevision,options:selected})).digest('hex');
}
export function ganDraftManifest(preview,rendered) {
  return {schema_version:1,kind:'draft',merged_body:preview.body,merged_body_sha256:rendered.merged_body_sha256,pdf_sha256:rendered.pdf_sha256,
    template_body:preview.template.body,template_body_sha256:rendered.template_body_sha256,template_version:preview.template.version,template_id:preview.template.id,
    sources:preview.sources,values:preview.values,projects:preview.projects,parts:rendered.parts,pages:rendered.pages,
    award_date:preview.awardDate,due_date:preview.dueDate,required_attachments:rendered.requiredAttachments,ready_for_sending:false};
}
export function publicGanDraft(document,revision=document.gan_revision) {
  return {id:document.id,application_id:document.application_id,application_number:document.application_number,organization_id:document.organization_id,
    organization_name:document.organization_name,status:document.status,revision,template_id:document.template_id,template_name:document.template_name,
    awarded_amount:document.gan_snapshot?.values?.total_award_amount||null,project_count:document.gan_snapshot?.projects?.length||0,template_version:document.gan_template_version,pdf_sha256:document.gan_pdf_sha256,generated_at:document.gan_generated_at,previewOnly:true,readyForSending:false};
}
