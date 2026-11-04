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
export function templateValueMap({application,nofo,templateMappings,projects,user}) {
  const raw={organization_name:application.organization_name,application_number:application.application_number,project_title:application.project_title,program_code:application.program_code,program_name:application.program_name,nofo_title:application.nofo_title||nofo?.title,requested_amount:application.requested_amount,awarded_amount:application.awarded_amount,match_amount:application.match_amount,performance_start:application.performance_start,performance_end:application.performance_end,submitted_by:application.submitted_by,today_date:new Date().toISOString().slice(0,10),projects};
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
