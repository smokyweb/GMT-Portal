import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import {PDFDocument,PDFName} from 'pdf-lib';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {migrateGanPackages} from '../services/documents/ganPackageMigration.js';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {saveGanAttachment,listGanAttachments,readGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
import {readGanPackage,readGanPackagePart,listGanPackages} from '../services/documents/ganPackageRead.js';
import {ganPackageHash} from '../services/documents/ganPackagePolicy.js';
import {inspectGanAttachmentPdf} from '../services/documents/pdf/ganAttachmentPdf.js';
import {createGanPackageRouter} from '../routes/ganPackages.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
async function pdf(text,pages=1,configure) {
  const doc=await PDFDocument.create();for(let i=1;i<=pages;i++)doc.addPage([612,792]).drawText(text+' page '+i,{x:40,y:740,size:15});
  if(configure)await configure(doc);return Buffer.from(await doc.save());
}
const uploadInput=(kind='special_conditions',pages=[2])=>({requestId:randomUUID(),kind,title:kind==='special_conditions'?'QA Special Conditions':'QA Blank Direct Deposit',signaturePages:pages});
test('GAN attachment and package versions preserve complete private draft packages',async t=>{
  const schema='gmt_qa_gan_packages_'+Date.now();assert.match(schema,/^gmt_qa_gan_packages_\d+$/);
  await live.query('CREATE SCHEMA '+schema);const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  try {
    const {ids,selection}=await seedGanDraftDatabase(db,schema);await migrateGanPackages(db);
    const conditionsPdf=await pdf('QA Conditions - no client legal content',2),depositPdf=await pdf('QA optional blank payment form',1,doc=>{const field=doc.getForm().createTextField('qa_name');field.addToPage(doc.getPages()[0],{x:40,y:600,width:300,height:25});field.setText('QA depositor placeholder');});
    let conditions,deposit,document,packageOne;
    const source=(input,bytes=conditionsPdf,actor=ids.admin,nofo=ids.nofo)=>saveGanAttachment(db,actor,nofo,input,bytes,'127.0.0.1');
    const prepare=(overrides={})=>saveGanPackage(db,ids.admin,document.id,{requestId:randomUUID(),expectedGanRevision:document.revision,expectedPackageRevision:0,conditionsId:conditions.id,...overrides},'127.0.0.1');
    await t.test('The explicit migration is idempotent and does not create source/package tables in public',async()=>{
      await migrateGanPackages(db);assert.equal((await db.query("SELECT to_regclass('public.gan_attachment_sources') AS source,to_regclass('public.gan_package_snapshots') AS package")).rows[0].source,null);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM gan_attachment_sources')).rows[0].n,0);
    });
    await t.test('Only scoped NOFO administrators can upload/list sources; members and reviewers are denied',async()=>{
      for(const actor of [ids.user,ids.otherAdmin,ids.reviewer])await assert.rejects(source(uploadInput(),conditionsPdf,actor),{status:403});
      conditions=(await source(uploadInput())).attachment;deposit=(await source(uploadInput('direct_deposit',[]),depositPdf)).attachment;
      assert.equal((await listGanAttachments(db,ids.admin,ids.nofo)).length,2);assert.equal((await listGanAttachments(db,ids.isc,ids.nofo)).length,2);
      await assert.rejects(listGanAttachments(db,ids.user,ids.nofo),{status:403});assert.deepEqual((await readGanAttachment(db,ids.admin,conditions.id)).pdf,conditionsPdf);
    });
    await t.test('PDF validation rejects bad bytes, page declarations, scripts and direct nested action dictionaries',async()=>{
      await assert.rejects(source(uploadInput(),Buffer.from('This is not a PDF')),{status:400});
      await assert.rejects(source(uploadInput(),Buffer.from('%PDF-1.7\nnot a valid PDF body\n%%EOF')),{status:422});
      await assert.rejects(source(uploadInput('special_conditions',[])),{status:400});await assert.rejects(source(uploadInput('special_conditions',[3])),{status:422});
      await assert.rejects(source({...uploadInput(),title:'bad\ntitle'}),{status:400});await assert.rejects(source({...uploadInput(),signaturePages:[2,2]}),{status:400});
      const scripted=await pdf('QA script',2,doc=>doc.addJavaScript('test','app.alert("synthetic");'));
      await assert.rejects(source(uploadInput(),scripted),{status:422});
      const nested=await pdf('QA nested',2,doc=>doc.catalog.set(PDFName.of('Names'),doc.context.obj({Nested:doc.context.obj({S:PDFName.of('JavaScript'),JS:doc.context.obj('synthetic')})})));
      await assert.rejects(source(uploadInput(),nested),{status:422});
      await assert.rejects(inspectGanAttachmentPdf(await pdf('oversized',1,doc=>doc.getPages()[0].setSize(3000,792)),[]),{status:422});
      assert.equal((await db.query('SELECT count(*)::int AS n FROM gan_attachment_sources')).rows[0].n,2);
    });
    await t.test('Source request retries are idempotent and immutable versions reject replacements/deletes',async()=>{
      const request=uploadInput(),created=await source(request),replay=await source(request);assert.equal(replay.replayed,true);assert.equal(replay.attachment.id,created.attachment.id);assert.equal(created.attachment.version,2);
      await assert.rejects(source({...request,title:'changed'}),{status:409});
      await assert.rejects(db.query('UPDATE gan_attachment_sources SET title=$2 WHERE id=$1',[conditions.id,'forged']),{code:'42501'});
      await assert.rejects(db.query('DELETE FROM gan_attachment_sources WHERE id=$1',[conditions.id]),{code:'42501'});
      assert.deepEqual((await readGanAttachment(db,ids.admin,conditions.id)).pdf,conditionsPdf);
    });
    await t.test('A complete package stores all PDF pages, exact source versions, identity and required return page offsets',async()=>{
      document=(await saveGanDraft(db,ids.admin,ids.app,{requestId:randomUUID(),expectedRevision:0,...selection})).document;
      const made=await prepare({depositId:deposit.id});packageOne=made.package;assert.equal(packageOne.package_revision,1);assert.equal(packageOne.previewOnly,true);assert.equal(packageOne.readyForSending,false);
      const saved=await readGanPackage(db,ids.admin,packageOne.id),parsed=await PDFDocument.load(saved.pdf);assert.equal(parsed.getPageCount(),4);assert.equal(parsed.getForm().getFields().length,0);assert.equal(saved.manifest.pages,4);assert.equal(saved.manifest.parts[0].title,'Grant Award Notice');
      assert.deepEqual(saved.manifest.parts.map(part=>[part.kind,part.page_start,part.page_end]),[['gan',1,1],['special_conditions',2,3],['direct_deposit',4,4]]);
      assert.deepEqual(saved.manifest.required_returns,[{kind:'gan',package_signature_pages:[1]},{kind:'special_conditions',package_signature_pages:[3]}]);
      assert.equal(saved.manifest.application_number,'APP-2026-00101');assert.deepEqual(saved.manifest.project_ids,['APP-2026-00101-P1']);assert.equal(ganPackageHash(saved.pdf),packageOne.pdf_sha256);
      assert.equal(saved.manifest.parts[1].source_id,conditions.id);assert.equal(saved.manifest.parts[1].source_version,1);
      assert.deepEqual((await readGanPackagePart(db,ids.admin,packageOne.id,conditions.id)).pdf,conditionsPdf);
      fs.mkdirSync('../output/pdf/gan-packages',{recursive:true});fs.writeFileSync('../output/pdf/gan-packages/qa-conditions-source.pdf',conditionsPdf);fs.writeFileSync('../output/pdf/gan-packages/qa-blank-deposit-source.pdf',depositPdf);fs.writeFileSync('../output/pdf/gan-packages/qa-package-r1.pdf',saved.pdf);
      fs.writeFileSync('../output/pdf/gan-packages/qa-package-r1-manifest.json',JSON.stringify(saved.manifest,null,2));
    });
    await t.test('Missing/wrong-type/cross-NOFO sources and stale/concurrent package choices are rejected',async()=>{
      await assert.rejects(prepare({conditionsId:null}),{status:400});
      await assert.rejects(prepare({expectedPackageRevision:1,conditionsId:deposit.id}),{status:403});
      await assert.rejects(prepare(),{status:409});
      const otherNofo=randomUUID();await db.query("INSERT INTO nofos SELECT (jsonb_populate_record(NULL::nofos,to_jsonb(n)||jsonb_build_object('id',$2::text,'title','QA alternate NOFO'))).* FROM nofos n WHERE id=$1",[ids.nofo,otherNofo]);
      const wrong=(await source(uploadInput(),conditionsPdf,ids.admin,otherNofo)).attachment;
      await assert.rejects(prepare({expectedPackageRevision:1,conditionsId:wrong.id}),{status:403});
      const concurrent=await Promise.allSettled([prepare({expectedPackageRevision:1}),prepare({expectedPackageRevision:1})]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.find(r=>r.status==='rejected').reason.status,409);
      const request={requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:2,conditionsId:conditions.id},first=await saveGanPackage(db,ids.admin,document.id,request),again=await saveGanPackage(db,ids.admin,document.id,request);
      assert.equal(again.replayed,true);assert.equal(again.package.id,first.package.id);await assert.rejects(saveGanPackage(db,ids.admin,document.id,{...request,depositId:deposit.id}),{status:409});
    });
    await t.test('Later source uploads and GAN regeneration leave old package bytes and original parts unchanged',async()=>{
      const before=await readGanPackage(db,ids.admin,packageOne.id),newSource=(await source(uploadInput(),await pdf('QA revised terms',2))).attachment;assert.ok(newSource.version>conditions.version);
      await db.query("UPDATE organizations SET address='200 QA Changed Road' WHERE id=$1",[ids.org]);
      document=(await saveGanDraft(db,ids.admin,ids.app,{requestId:randomUUID(),expectedRevision:1,...selection})).document;
      const old=await readGanPackage(db,ids.admin,packageOne.id);assert.deepEqual(old.pdf,before.pdf);assert.equal(old.package.gan_revision,1);
      assert.deepEqual((await readGanPackagePart(db,ids.admin,packageOne.id,conditions.id)).pdf,conditionsPdf);
      await assert.rejects(prepare({expectedGanRevision:1,expectedPackageRevision:3}),{status:409});
      const next=await prepare({expectedPackageRevision:3,conditionsId:newSource.id});const current=await readGanPackage(db,ids.admin,next.package.id);assert.equal(current.manifest.parts.length,2);assert.equal(current.manifest.pages,3);assert.equal(current.package.gan_revision,2);
    });
    await t.test('Failed audit writes roll back package/source versions and SQL cannot rewrite immutable snapshots',async()=>{
      const faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>sql.includes('INSERT INTO audit_logs')?Promise.reject(new Error('synthetic package audit failure')):client.query(sql,args)};}};
      const before=(await listGanPackages(db,ids.admin,document.id)).length,sourceBefore=(await listGanAttachments(db,ids.admin,ids.nofo)).length;
      await assert.rejects(saveGanPackage(faulty,ids.admin,document.id,{requestId:randomUUID(),expectedGanRevision:2,expectedPackageRevision:4,conditionsId:conditions.id}),/synthetic package audit failure/);
      await assert.rejects(saveGanAttachment(faulty,ids.admin,ids.nofo,uploadInput(),conditionsPdf),/synthetic package audit failure/);
      assert.equal((await listGanPackages(db,ids.admin,document.id)).length,before);assert.equal((await listGanAttachments(db,ids.admin,ids.nofo)).length,sourceBefore);
      await assert.rejects(db.query("UPDATE gan_package_snapshots SET manifest='{}' WHERE id=$1",[packageOne.id]),{code:'42501'});await assert.rejects(db.query('DELETE FROM gan_package_snapshots WHERE id=$1',[packageOne.id]),{code:'42501'});
      for(const actor of [ids.user,ids.otherAdmin,ids.otherUser,ids.reviewer])await assert.rejects(readGanPackage(db,actor,packageOne.id),{status:403});
    });
    await t.test('A multi-project GAN retains its Schedule before conditions and maps signature pages correctly',async()=>{
      await db.query('CREATE TABLE application_projects(id UUID PRIMARY KEY,application_id TEXT,project_id TEXT,name TEXT,poete TEXT,federal_amount NUMERIC,match_amount NUMERIC)');
      for(let i=1;i<=5;i++)await db.query("INSERT INTO application_projects VALUES($1,$2,$3,$4,'Equipment',100,100)",[randomUUID(),ids.secondApp,'APP-2026-00102-P'+i,'QA schedule project '+i]);
      const scheduled=(await saveGanDraft(db,ids.admin,ids.secondApp,{requestId:randomUUID(),expectedRevision:0,...selection})).document;
      const made=await saveGanPackage(db,ids.admin,scheduled.id,{requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:0,conditionsId:conditions.id});
      const saved=await readGanPackage(db,ids.admin,made.package.id);assert.equal(saved.manifest.pages,4);assert.deepEqual(saved.manifest.parts.map(p=>[p.kind,p.page_start,p.page_end]),[['gan',1,2],['special_conditions',3,4]]);
      assert.deepEqual(saved.manifest.required_returns[1].package_signature_pages,[4]);assert.deepEqual(saved.manifest.project_ids,Array.from({length:5},(_,i)=>'APP-2026-00102-P'+(i+1)));
      fs.writeFileSync('../output/pdf/gan-packages/qa-package-with-schedule.pdf',saved.pdf);fs.writeFileSync('../output/pdf/gan-packages/qa-package-with-schedule-manifest.json',JSON.stringify(saved.manifest,null,2));
    });
    await t.test('Reads detect corrupted stored PDF and manifest bytes in an isolated rolled-back transaction',async()=>{
      const client=await db.connect();try{
        await client.query('BEGIN');await client.query('ALTER TABLE gan_package_snapshots DISABLE TRIGGER protect_gan_package_snapshot');
        await client.query("UPDATE gan_package_snapshots SET pdf=$2 WHERE id=$1",[packageOne.id,Buffer.from('corrupt fixture bytes')]);await assert.rejects(readGanPackage(client,ids.admin,packageOne.id),{status:500});
      }finally{await client.query('ROLLBACK');client.release();}
      const client2=await db.connect();try{
        await client2.query('BEGIN');await client2.query('ALTER TABLE gan_package_snapshots DISABLE TRIGGER protect_gan_package_snapshot');
        await client2.query("UPDATE gan_package_snapshots SET manifest=jsonb_set(manifest,'{application_number}','\"forged\"') WHERE id=$1",[packageOne.id]);await assert.rejects(readGanPackage(client2,ids.admin,packageOne.id),{status:500});
      }finally{await client2.query('ROLLBACK');client2.release();}
      assert.equal((await readGanPackage(db,ids.admin,packageOne.id)).package.pdf_sha256,packageOne.pdf_sha256);
    });
    await t.test('Actual authenticated HTTP multipart uploads/downloads enforce scope, private caching, integrity and audit',async()=>{
      const app=express();app.use(express.json());app.use('/api/gan',createGanPackageRouter(db,createAuthentication(db)));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,actor='admin',options={})=>fetch(base+'/api/gan'+path,{...options,headers:{...(actor?{Authorization:'Bearer '+generateToken({id:ids[actor]})}:{}),...options.headers}});
      const path='/nofos/'+ids.nofo+'/attachments';assert.equal((await call(path,null)).status,401);assert.equal((await call(path,'user')).status,403);assert.equal((await call(path,'otherAdmin')).status,403);
      const form=new FormData();for(const [key,value] of Object.entries(uploadInput()))form.append(key,Array.isArray(value)?JSON.stringify(value):value);form.append('file',new Blob([conditionsPdf],{type:'application/pdf'}),'conditions.pdf');
      const created=await call(path,'admin',{method:'POST',body:form});const uploadedBody=await created.json();assert.equal(created.status,201,JSON.stringify(uploadedBody));const uploaded=uploadedBody.attachment;
      const download=await call('/attachments/'+uploaded.id+'/pdf');assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'private, no-store');assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.equal(ganPackageHash(Buffer.from(await download.arrayBuffer())),uploaded.pdf_sha256);
      const preview=await call('/packages/'+packageOne.id);assert.equal(preview.status,200);const pdfResponse=await call('/packages/'+packageOne.id+'/pdf');assert.equal(pdfResponse.status,200);assert.equal(pdfResponse.headers.get('x-gmt-document-preview'),'true');assert.equal(ganPackageHash(Buffer.from(await pdfResponse.arrayBuffer())),packageOne.pdf_sha256);
      assert.equal((await call('/packages/'+packageOne.id+'/pdf','user')).status,403);assert.equal((await call('/packages/'+packageOne.id+'/parts/'+randomUUID())).status,404);
      const part=await call('/packages/'+packageOne.id+'/parts/'+conditions.id);assert.deepEqual(Buffer.from(await part.arrayBuffer()),conditionsPdf);
      assert.equal((await call('/documents/'+document.id+'/packages','admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:4,conditionsId:conditions.id})})).status,409);
      const actions=(await db.query("SELECT action FROM audit_logs WHERE action LIKE 'GAN%Package%' OR action LIKE 'GANAttachment%'")).rows.map(r=>r.action);for(const action of ['GANAttachmentDownloaded','GANDraftPackagePreviewed','GANDraftPackageDownloaded','GANPackagePartDownloaded'])assert.ok(actions.includes(action));
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
