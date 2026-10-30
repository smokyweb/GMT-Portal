import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {PDFDocument} from 'pdf-lib';
import {randomUUID} from 'node:crypto';
import live from '../db/connection.js';
import {saveGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
import {transitionGan} from '../services/documents/ganWorkflow.js';
import {loadGanIssue} from '../services/documents/ganWorkflowIntegrity.js';
import {saveGanSignatureSettings} from '../services/documents/ganSignatureSettings.js';
import {renderGanIssuedPackage} from '../services/documents/ganIssuePdf.js';
const meta=JSON.parse(fs.readFileSync('../.git/gmt-account-preview.json','utf8')),fixture=JSON.parse(fs.readFileSync('../.git/gmt-gan-browser-fixture.json','utf8'));
if(!/^gmt_qa_preview_\d+$/.test(meta.schema)||meta.schema!==fixture.schema)throw Error('Return browser fixtures require the exact isolated preview');
const db=new pg.Pool({...live.options,options:'-c search_path='+meta.schema+',public'});
try{
 if((await db.query('SELECT current_schema() AS name')).rows[0].name!==meta.schema)throw Error('Unexpected schema');
 const actor=(await db.query("SELECT id FROM users WHERE email='qa-state-admin@gmt-qa.invalid'")).rows[0].id,out=path.resolve('../output/playwright');fs.mkdirSync(out,{recursive:true});
 for(const item of fixture.documents){
  if(item.kind==='budget'){
   const isc=(await db.query("SELECT id FROM users WHERE email='qa-admin@gmt-qa.invalid'")).rows[0].id;await saveGanSignatureSettings(db,isc,fixture.templateId,{expectedRevision:0,allowedMethods:['upload']});
   const blank=await PDFDocument.create();blank.addPage([612,792]).drawText('QA BLANK DIRECT DEPOSIT - NOT A CLIENT FORM',{x:40,y:700});
   const deposit=(await saveGanAttachment(db,actor,fixture.nofoId,{requestId:randomUUID(),kind:'direct_deposit',title:'QA Blank Deposit',signaturePages:[]},Buffer.from(await blank.save()))).attachment;
   const old=(await db.query('SELECT manifest FROM gan_package_snapshots WHERE id=$1',[item.packageId])).rows[0].manifest;
   const next=(await saveGanPackage(db,actor,item.documentId,{requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:1,conditionsId:old.parts.find(part=>part.kind==='special_conditions').source_id,depositId:deposit.id})).package;item.packageId=next.id;
   const complete=await PDFDocument.create();complete.addPage([612,792]).drawText('QA COMPLETED DEPOSIT - NO REAL BANK INFORMATION',{x:40,y:700});item.depositFile=path.join(out,'gan-return-budget-deposit.pdf');fs.writeFileSync(item.depositFile,await complete.save());
  }
  const sent=await transitionGan(db,actor,item.documentId,'send',{requestId:randomUUID(),expectedRevision:0,packageId:item.packageId},'127.0.0.1'),issue=await loadGanIssue(db,sent.issue.id);
  const rendered=await renderGanIssuedPackage(db,issue.manifest.gan,issue.manifest.package,{recipient:{name:issue.manifest.recipient.name,title:'Emergency Manager',displayDate:'October 29, 2026 - QA ONLY'}});
  const source=await PDFDocument.load(rendered.pdf),gan=await PDFDocument.create();for(const page of await gan.copyPages(source,[0])){gan.addPage(page);page.drawText('SYNTHETIC QA RETURN - NOT A CLIENT DOCUMENT',{x:40,y:24,size:8});}
  const conditions=await PDFDocument.create();const part=rendered.parts.find(part=>part.kind==='special_conditions'),index=part.signature_pages[0]-1;
  for(const page of await conditions.copyPages(source,[index])){conditions.addPage(page);page.drawText('QA signature: GMT QA Subrecipient - October 29, 2026',{x:40,y:620,size:11});}
  item.issueId=issue.id;item.ganFile=path.join(out,'gan-return-'+item.kind+'-gan.pdf');item.conditionsFile=path.join(out,'gan-return-'+item.kind+'-conditions.pdf');
  fs.writeFileSync(item.ganFile,await gan.save());fs.writeFileSync(item.conditionsFile,await conditions.save());
 }
 fs.writeFileSync('../.git/gmt-gan-browser-fixture.json',JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({port:meta.port,documents:fixture.documents}));
}finally{await db.end();await live.end();}
