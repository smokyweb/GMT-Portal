import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolveGanTokens} from '../../src/lib/documents/ganTokens.js';
import {renderGanPdfPreview} from '../services/documents/ganPdfPreview.js';
import {ganPdfData} from './fixtures/ganPdfData.mjs';
const project=fileURLToPath(new URL('../../',import.meta.url));
const body=code=>fs.readFileSync(new URL('../templates/gan/GAN_'+code+'_portal_body.md',import.meta.url),'utf8');
const render=(input=ganPdfData(),template=body(input.program.code))=>renderGanPdfPreview(resolveGanTokens(template,input),{programCode:input.program.code,templateBody:template,templateVersion:3});
function inspect(pdf) {
  const result=spawnSync('python3',[fileURLToPath(new URL('./fixtures/inspectGanPdf.py',import.meta.url))],{
    input:pdf,env:{...process.env,PYTHONPATH:path.join(project,'.git/gmt-qa-python')},maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stderr?.toString());return JSON.parse(result.stdout);
}
function bounds(page) {
  assert.equal(page.width,612);assert.equal(page.height,792);
  assert.ok(page.bounds[0]>=27);assert.ok(page.bounds[1]>=25);assert.ok(page.bounds[2]<=585);assert.ok(page.bounds[3]<=768);
}
test('All four client GANs retain thirteen blocks, actual identifiers, program conditions and readable page bounds',()=>{
  for(const code of ['EMPG','NSGP','SHSP','SLCGP']) {
    const result=render(ganPdfData(code)),parsed=inspect(result.pdf);assert.equal(parsed.pages.length,1);assert.equal(result.pages,1);
    const page=parsed.pages[0],text=page.text.replace(/\s+/g,' ');bounds(page);
    for(let i=1;i<=13;i++)assert.match(text,new RegExp('(?:^| )'+i+'\\. '));
    for(const expected of ['APP-2026-00101','NE-'+code+'-2026-001',ganPdfData(code).award.fields.federal_award_number,ganPdfData(code).award.fields.cfda_number,'María García','$500.00','Special Conditions','DRAFT PREVIEW - NOT SENT OR EXECUTED'])assert.ok(text.includes(expected),code+' missing '+expected);
    assert.ok(!text.includes('{{'));assert.equal(result.template_version,3);assert.equal(result.previewOnly,true);assert.equal(result.readyForSending,false);
    assert.deepEqual(result.requiredAttachments,['Special Conditions']);assert.ok(result.layout.ganBottom<739);
    assert.equal(result.pdf_sha256,createHash('sha256').update(result.pdf).digest('hex'));
    assert.equal(result.merged_body_sha256,createHash('sha256').update(result.merged_body).digest('hex'));
    assert.ok(text.includes(code==='NSGP'?'Bi-annual progress reports.':code==='EMPG'?'NIMS implementation required.':'Program Requirements:'));
  }
});
test('More than four projects creates one attached schedule with every full project ID and reconciled totals',()=>{
  const result=render(ganPdfData('EMPG',5)),parsed=inspect(result.pdf);assert.equal(parsed.pages.length,2);assert.deepEqual(result.parts,['Grant Award Notice','Project Schedule']);
  assert.ok(parsed.pages[0].text.includes('See attached Project Schedule'));assert.ok(!parsed.pages[0].text.includes('APP-2026-00101-P1'));
  const schedule=parsed.pages[1];bounds(schedule);for(let i=1;i<=5;i++)assert.ok(schedule.text.includes('APP-2026-00101-P'+i));
  assert.ok(schedule.text.includes('Total federal: $500.00'));assert.ok(schedule.text.includes('Total match: $500.00'));
  assert.ok(schedule.text.includes('2 of 2'));assert.ok(schedule.text.includes('DRAFT PREVIEW'));
});
test('Up to four projects stay in block 5 and long source values wrap without clipping',()=>{
  const input=ganPdfData('EMPG',4);input.organization.name='QA Metropolitan Emergency Management and Regional Preparedness Coordination Authority';
  input.grantee.agency_name='Nebraska Emergency Management Agency - Preparedness and Resilience Division';
  const result=render(input),page=inspect(result.pdf).pages[0];bounds(page);
  assert.equal(result.pages,1);assert.ok(page.text.includes('Coordination Authority'));for(let i=1;i<=4;i++)assert.ok(page.text.includes('APP-2026-00101-P'+i));
});
test('PDF bytes are stable for the same checked body and template version',()=>{
  const first=render(),second=render();assert.equal(first.pdf_sha256,second.pdf_sha256);assert.deepEqual(first.pdf,second.pdf);
});
test('Missing or unresolved GAN values, altered merge bodies and incompatible program/project metadata are rejected',()=>{
  const input=ganPdfData();input.award.fields.subaward_number=null;assert.throws(()=>render(input),{status:422});
  const template=body('EMPG'),preview=resolveGanTokens(template,ganPdfData());
  assert.throws(()=>renderGanPdfPreview({...preview,body:preview.body+'Injected text'},{programCode:'EMPG',templateBody:template,templateVersion:1}),{status:422});
  assert.throws(()=>renderGanPdfPreview(preview,{programCode:'NSGP',templateBody:body('NSGP'),templateVersion:1}),{status:422});
  assert.throws(()=>renderGanPdfPreview({...preview,requiresProjectSchedule:true},{programCode:'EMPG',templateBody:template,templateVersion:1}),{status:422});
});
test('Custom template text is not silently discarded by the fixed client PDF layout',()=>{
  assert.throws(()=>render(ganPdfData(),body('EMPG')+'\nExtra contractual term'),{status:422});
});
test('Overlong GAN content and project schedules fail visibly rather than truncate or create an unreadable page',()=>{
  const input=ganPdfData();input.application.project_narrative='Long source narrative '.repeat(1200);
  assert.throws(()=>render(input),error=>error.status===422&&error.code==='gan_pdf_overflow'&&error.section==='Grant Award Notice');
  const many=ganPdfData('EMPG',100);assert.throws(()=>render(many),error=>error.status===422&&error.code==='gan_pdf_overflow'&&error.section==='Project Schedule');
});
test('Unsupported font characters fail explicitly; Unicode official names retain their text',()=>{
  const input=ganPdfData();input.organization.name='QA County 😀';assert.throws(()=>render(input),error=>error.status===422&&error.message.includes('font'));
});
