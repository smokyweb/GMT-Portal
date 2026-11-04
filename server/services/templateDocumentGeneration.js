import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const tokenPattern=/\{\{\s*([^}]+?)\s*\}\}/g;
function replaceTokens(text,values) {
  return String(text||'').replace(/\{\{#each\s+projects\s*\}\}([\s\S]*?)\{\{\/each\s*\}\}/g,(_m,block)=>(values.projects||[]).map(project=>replaceTokens(block,{...values,...Object.fromEntries(Object.entries(project).map(([key,value])=>[`projects.${key}`,value]))})).join(''))
    .replace(tokenPattern,(_m,key)=>values[key.trim()] ?? '');
}
function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export async function generateTemplateFile({sourcePath,outputPath,values}) {
  const zip=await JSZip.loadAsync(await fs.readFile(sourcePath));
  for(const name of Object.keys(zip.files).filter(item=>/^word\/(document|header\d*|footer\d*)\.xml$/i.test(item))) {
    const xml=await zip.file(name).async('string');
    const populated=replaceTokens(xml,values);
    zip.file(name,populated);
  }
  await fs.writeFile(outputPath,await zip.generateAsync({type:'nodebuffer'}));
}
export function templateValueMap({application,nofo,organization={},program={},grantee={},templateMappings,projects,user={}}) {
  const raw={
    ...application, ...Object.fromEntries(Object.entries(organization).map(([key,value])=>[`organization_${key}`,value])),
    ...Object.fromEntries(Object.entries(program).map(([key,value])=>[`program_${key}`,value])),
    ...Object.fromEntries(Object.entries(grantee).map(([key,value])=>[`grantee_${key}`,value])),
    organization_name:organization.name||application.organization_name,
    organization_type:organization.type, organization_ein:organization.ein, organization_sam_uei:organization.sam_uei,
    organization_address:organization.address, organization_address_line_2:organization.address_line_2,
    organization_city:organization.city, organization_state:organization.state, organization_zip:organization.zip,
    organization_county:organization.county, organization_region:organization.region, organization_duns:organization.duns,
    organization_vendor_number:organization.vendor_number, organization_legacy_spars_id:organization.legacy_spars_id,
    nofo_title:application.nofo_title||nofo?.title, nofo_summary:nofo?.summary, fiscal_year:nofo?.fiscal_year,
    grant_number:nofo?.grant_number, state_grant_number:nofo?.state_grant_number, cfda_number:nofo?.cfda_number,
    cfda_title:nofo?.cfda_title, funding_stream:nofo?.funding_stream, eligibility_criteria:nofo?.eligibility_criteria,
    allowable_costs:nofo?.allowable_costs, evaluation_criteria:nofo?.evaluation_criteria,
    total_funding_available:nofo?.total_funding_available, min_award:nofo?.min_award, max_award:nofo?.max_award,
    local_share_amount:nofo?.local_share_amount, local_share_pct:nofo?.local_share_pct,
    state_share_amount:nofo?.state_share_amount, state_share_pct:nofo?.state_share_pct, mou_amount:nofo?.mou_amount,
    open_date:nofo?.open_date, close_date:nofo?.close_date, federal_performance_start:nofo?.federal_performance_start,
    federal_performance_end:nofo?.federal_performance_end, legacy_grant_id:nofo?.legacy_grant_id,
    primary_contact_name: user.primary_contact_name, primary_contact_title:user.primary_contact_title,
    primary_contact_email:user.primary_contact_email, primary_contact_phone:user.primary_contact_phone,
    today_date:new Date().toISOString().slice(0,10), projects,
  };
  return Object.fromEntries(Object.entries(templateMappings||{}).map(([token,field])=>[token,raw[field] ?? '']));
}
export function templateTokens(text=''){return [...String(text).matchAll(tokenPattern)].map(match=>match[1].trim()).filter(token=>!token.startsWith('#')&&!token.startsWith('/'));}
export async function ensureTemplatePath(uploadsDir,fileUrl){
  const filename=path.basename(String(fileUrl||'').split('?')[0]);
  if(!filename||!/^[-a-zA-Z0-9._]+$/.test(filename))throw new Error('Invalid template file');
  const filePath=path.resolve(uploadsDir,filename);
  if(path.dirname(filePath)!==path.resolve(uploadsDir))throw new Error('Invalid template file');
  await fs.access(filePath); return filePath;
}
export {xmlEscape};
