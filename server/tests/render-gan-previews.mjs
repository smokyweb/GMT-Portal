import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveGanTokens} from '../../src/lib/documents/ganTokens.js';
import {renderGanPdfPreview} from '../services/documents/ganPdfPreview.js';
import {ganPdfData} from './fixtures/ganPdfData.mjs';
const output=fileURLToPath(new URL('../../output/pdf/',import.meta.url));fs.mkdirSync(output,{recursive:true});
const samples=['EMPG','NSGP','SHSP','SLCGP'].map(code=>[code.toLowerCase(),ganPdfData(code)]);
samples.push(['empg-project-schedule',ganPdfData('EMPG',5)]);
const long=ganPdfData('EMPG',4);long.organization.name='QA Metropolitan Emergency Management and Regional Preparedness Coordination Authority';
long.grantee.agency_name='Nebraska Emergency Management Agency - Preparedness and Resilience Division';samples.push(['empg-four-projects',long]);
const manifest=[];
for(const [name,input] of samples) {
  const templateBody=fs.readFileSync(new URL('../templates/gan/GAN_'+input.program.code+'_portal_body.md',import.meta.url),'utf8');
  const preview=resolveGanTokens(templateBody,input),result=renderGanPdfPreview(preview,{programCode:input.program.code,templateBody,templateVersion:3});
  const file='gan-'+name+'-qa-preview.pdf';fs.writeFileSync(path.join(output,file),result.pdf);
  manifest.push({file,sha256:result.pdf_sha256,pages:result.pages,parts:result.parts,layout:result.layout,previewOnly:result.previewOnly});
}
fs.writeFileSync(path.join(output,'gan-preview-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest));
