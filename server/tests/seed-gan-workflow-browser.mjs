import fs from 'node:fs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import live from '../db/connection.js';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {saveGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
const meta=JSON.parse(fs.readFileSync('../.git/gmt-account-preview.json','utf8')),fixture=JSON.parse(fs.readFileSync('../.git/gmt-gan-browser-fixture.json','utf8'));
if(!/^gmt_qa_preview_\d+$/.test(meta.schema)||meta.schema!==fixture.schema)throw Error('Workflow browser fixtures require the exact isolated preview');
const db=new pg.Pool({...live.options,options:'-c search_path='+meta.schema+',public'});
try{
  if((await db.query('SELECT current_schema() AS name')).rows[0].name!==meta.schema)throw Error('Unexpected schema');
  const actor=(await db.query("SELECT id FROM users WHERE email='qa-state-admin@gmt-qa.invalid'")).rows[0].id;
  const pdf=await PDFDocument.create();pdf.addPage([612,792]).drawText('QA SPECIAL CONDITIONS - SYNTHETIC TEST ONLY',{x:40,y:700});pdf.addPage([612,792]).drawText('QA CONDITIONS SIGNATURE PAGE - NOT CLIENT LEGAL TEXT',{x:40,y:700});
  const attachment=(await saveGanAttachment(db,actor,fixture.nofoId,{requestId:randomUUID(),kind:'special_conditions',title:'QA Special Conditions - synthetic only',signaturePages:[2]},Buffer.from(await pdf.save()))).attachment;
  const documents=[];
  for(const record of fixture.cases.filter(row=>row.kind!=='missing')){
    if(record.kind==='budget')await db.query('UPDATE application_budgets SET amount_requested=500 WHERE application_id=$1',[record.id]);
    const selection={templateId:fixture.templateId,authorizedOfficialId:fixture.officialId,granteeId:fixture.granteeId,awardDate:'2026-10-29',dueDate:'2026-11-30'};
    const draft=(await saveGanDraft(db,actor,record.id,{requestId:randomUUID(),expectedRevision:0,...selection})).document;
    const pack=(await saveGanPackage(db,actor,draft.id,{requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:0,conditionsId:attachment.id})).package;
    documents.push({kind:record.kind,documentId:draft.id,packageId:pack.id});
  }
  fs.writeFileSync('../.git/gmt-gan-browser-fixture.json',JSON.stringify({...fixture,documents},null,2)+'\n');console.log(JSON.stringify({documents}));
}finally{await db.end();await live.end();}
