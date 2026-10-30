import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {accountError} from '../../accountPolicy.js';
import {ganTemplateTokens} from '../../../../src/lib/documents/ganTokens.js';
const clean=value=>String(value??'').replace(/\*\*/g,'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/[–—]/g,'-').trim();
export function ganPdfModel(preview,{programCode,templateBody,templateVersion}={}) {
  if(!preview?.ready||preview.issues?.length)throw accountError(422,'Resolve the GAN preview issues before rendering its PDF');
  if(!['EMPG','NSGP','SHSP','SLCGP'].includes(programCode)||!Number.isInteger(templateVersion)||templateVersion<1)throw accountError(400,'Select a supported GAN program and saved template version');
  if(preview.values?.program_code!==programCode||Boolean(preview.requiresProjectSchedule)!==(preview.projects?.length>4))throw accountError(422,'Regenerate the GAN with its saved program and complete project list');
  const canonical=fs.readFileSync(new URL('../../../templates/gan/GAN_'+programCode+'_portal_body.md',import.meta.url),'utf8');
  if(templateBody!==canonical)throw accountError(422,'This template needs a reviewed thirteen-block PDF layout before it can be rendered');
  const merged=templateBody.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,key)=>String(preview.values?.[key]??''));
  if(merged!==preview.body||ganTemplateTokens(merged).length||/\{\{|\}\}/.test(merged))throw accountError(422,'Regenerate the GAN from its checked template and records');
  const v=Object.fromEntries(Object.entries(preview.values).map(([key,value])=>[key,String(value??'').replace(/[–—]/g,'-').trim()]));
  const paragraphs=merged.slice(merged.indexOf('**8. Debarment'),merged.indexOf('### 9. Agency')).split(/\n\s*\n/).map(clean).filter(text=>text&&text!=='---');
  const get=(pattern,label)=>{const found=paragraphs.find(text=>pattern.test(text));if(!found)throw accountError(422,'Restore the GAN '+label+' paragraph');return found;};
  return {values:v,projects:preview.projects.map(project=>Object.fromEntries(Object.entries(project).map(([key,value])=>[key,typeof value==='string'?clean(value):value]))),
    requiresProjectSchedule:preview.requiresProjectSchedule,programCode,templateVersion,body:preview.body,
    bodyHash:createHash('sha256').update(preview.body).digest('hex'),templateHash:createHash('sha256').update(templateBody).digest('hex'),
    certification:get(/^8\. Debarment/,'certification'),terms:get(/^Terms and Conditions:/,'terms'),programTerms:get(/^Program Requirements:/,'program requirements'),
    contact:get(/^Contact information/,'contact'),returnInstructions:clean(merged.split('**13. DUE DATE:')[1]?.split('**')[1])};
}
