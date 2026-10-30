import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {readGanDraft} from '../services/documents/ganDraftRead.js';
import {migrateGanDrafts} from '../services/documents/ganDraftMigration.js';
import {createGanDraftRouter} from '../routes/ganDrafts.js';
import {createGanDocumentEntityAccess} from '../middleware/ganDocumentEntityAccess.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
test('GAN draft snapshots persist atomically, stay immutable and preserve access boundaries',async t=>{
  const schema='gmt_qa_gan_drafts_'+Date.now();assert.match(schema,/^gmt_qa_gan_drafts_\d+$/);
  await live.query('CREATE SCHEMA '+schema);const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  try {
    const {ids,selection}=await seedGanDraftDatabase(db,schema);
    const request=(expectedRevision=0,changes={})=>({...selection,requestId:randomUUID(),expectedRevision,...changes});
    const save=(input,app='app',who='admin')=>saveGanDraft(db,ids[who],ids[app],input,'127.0.0.1');
    const count=async table=>Number((await db.query('SELECT count(*) FROM '+table)).rows[0].count);
    let first,initialRequest,original;
    await t.test('Saving a draft stores checked text, bytes, hashes and template version together with one audit entry',async()=>{
      initialRequest=request();first=await save(initialRequest);assert.equal(first.replayed,false);assert.equal(first.document.status,'Draft');assert.equal(first.document.revision,1);
      original=await readGanDraft(db,ids.admin,first.document.id);
      assert.equal(original.snapshot.template_version,3);assert.equal(original.snapshot.sources.authorizedOfficialId,ids.official);
      assert.equal(original.snapshot.ready_for_sending,false);assert.ok(original.snapshot.merged_body.includes('QA Draft County'));
      assert.equal(createHash('sha256').update(original.pdf).digest('hex'),original.document.pdf_sha256);
      assert.equal(await count('generated_documents'),1);assert.equal(await count('gan_document_snapshots'),1);assert.equal(await count('audit_logs'),1);
      assert.ok((await db.query('SELECT description FROM audit_logs')).rows[0].description.includes('IP: 127.0.0.1'));
      await migrateGanDrafts(db);assert.equal(await count('gan_document_snapshots'),1);
    });
    await t.test('Retries replay the original snapshot without duplicates, and changed selections cannot reuse its key',async()=>{
      const result=await save(initialRequest);assert.equal(result.replayed,true);assert.equal(result.document.pdf_sha256,first.document.pdf_sha256);
      assert.equal(await count('gan_document_snapshots'),1);assert.equal(await count('audit_logs'),1);
      await assert.rejects(save({...initialRequest,dueDate:'2026-12-01'}),{status:409});
    });
    await t.test('Current source edits do not change the stored PDF; explicit regeneration preserves old history',async()=>{
      await db.query("UPDATE organizations SET name='QA Renamed County' WHERE id=$1",[ids.org]);
      const stored=await readGanDraft(db,ids.admin,first.document.id);assert.deepEqual(stored.pdf,original.pdf);assert.ok(stored.snapshot.merged_body.includes('QA Draft County'));
      const regenerated=await save(request(1));assert.equal(regenerated.document.revision,2);
      const current=await readGanDraft(db,ids.admin,first.document.id);assert.ok(current.snapshot.merged_body.includes('QA Renamed County'));assert.notEqual(current.document.pdf_sha256,original.document.pdf_sha256);
      assert.equal(current.history.length,2);assert.deepEqual((await readGanDraft(db,ids.admin,first.document.id,1)).pdf,original.pdf);
      const oldRetry=await save(initialRequest);assert.equal(oldRetry.replayed,true);assert.equal(oldRetry.document.revision,1);assert.equal(oldRetry.document.pdf_sha256,original.document.pdf_sha256);
    });
    await t.test('Stale revisions and concurrent generation never overwrite a saved snapshot',async()=>{
      await assert.rejects(save(request(1)),{status:409});
      const inputs=[request(2),request(2)],results=await Promise.allSettled(inputs.map(input=>save(input)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
      const current=await readGanDraft(db,ids.admin,first.document.id);assert.equal(current.document.revision,3);assert.equal(current.history.length,3);
    });
    await t.test('Recipients, reviewers, other-state admins and inactive admins cannot generate or read unsent drafts',async()=>{
      for(const who of ['user','reviewer','otherAdmin','otherUser']) {
        await assert.rejects(save(request(3),'app',who),{status:403});
        await assert.rejects(readGanDraft(db,ids[who],first.document.id),{status:403});
      }
      assert.equal((await readGanDraft(db,ids.isc,first.document.id)).document.revision,3);
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.admin]);await assert.rejects(save(request(3)),{status:401});
      await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.admin]);
    });
    await t.test('Invalid source data and a failed audit roll back both document and snapshot inserts',async()=>{
      await db.query('UPDATE application_budgets SET amount_requested=499 WHERE application_id=$1',[ids.secondApp]);
      await assert.rejects(save(request(),'secondApp'),{status:422});assert.equal(await count('generated_documents'),1);
      await db.query('UPDATE application_budgets SET amount_requested=500 WHERE application_id=$1',[ids.secondApp]);
      const failing={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>sql.includes('INSERT INTO audit_logs')?Promise.reject(new Error('synthetic audit failure')):client.query(sql,args)};}};
      await assert.rejects(saveGanDraft(failing,ids.admin,ids.secondApp,request()),/synthetic audit failure/);
      assert.equal(await count('generated_documents'),1);assert.equal(await count('gan_document_snapshots'),3);
    });
    await t.test('Generic SQL writes cannot replace snapshots, tamper with hashes, erase history or forge status',async()=>{
      await assert.rejects(db.query("UPDATE generated_documents SET populated_body='forged' WHERE id=$1",[first.document.id]),{code:'42501'});
      await assert.rejects(db.query("UPDATE generated_documents SET status='Sent' WHERE id=$1",[first.document.id]),{code:'42501'});
      await assert.rejects(db.query('DELETE FROM generated_documents WHERE id=$1',[first.document.id]),{code:'42501'});
      await assert.rejects(db.query("UPDATE gan_document_snapshots SET snapshot='{}'"),{code:'42501'});
      await assert.rejects(db.query('DELETE FROM gan_document_snapshots'),{code:'42501'});
      const client=await db.connect();
      try {
        await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','draft',true)");
        await assert.rejects(client.query("UPDATE generated_documents SET gan_revision=gan_revision+1,gan_pdf_sha256='forged' WHERE id=$1",[first.document.id]),{code:'23514'});
      }finally{await client.query('ROLLBACK');client.release();}
    });
    await t.test('Bad draft payloads and corrupted stored bytes cannot bypass validation or return a document',async()=>{
      for(const changes of [{requestId:'bad'},{expectedRevision:-1},{awarded_amount:1},{snapshot:{pdf_sha256:'forged'}}])await assert.rejects(save(request(3,changes)),{status:400});
      const corrupt={query:async(sql,args)=>{const result=await db.query(sql,args);if(sql.startsWith('SELECT * FROM gan_document_snapshots WHERE document_id='))result.rows[0].pdf=Buffer.from('tampered PDF');return result;}};
      await assert.rejects(readGanDraft(corrupt,ids.admin,first.document.id),{status:500});
    });
    await t.test('A preexisting legacy GAN must be reconciled rather than duplicated',async()=>{
      await db.query("INSERT INTO generated_documents(template_id,application_id,organization_id,doc_type,status) VALUES($1,$2,$3,'Grant Award Notice','Sent')",[ids.template,ids.legacyApp,ids.org]);
      await assert.rejects(save(request(),'legacyApp'),{status:409});
    });
    await t.test('Owned HTTP reads return the saved snapshot and PDF; generic routes redact and protect managed records',async()=>{
      const app=express(),authenticate=createAuthentication(db);app.use(express.json());app.use('/api/gan',createGanDraftRouter(db,authenticate));
      app.use('/api/entities/:entity/:id?',authenticate,createGanDocumentEntityAccess(db));
      app.get('/api/entities/GeneratedDocument',async(req,res)=>res.json((await db.query('SELECT * FROM generated_documents')).rows));
      app.get('/api/entities/GeneratedDocument/:id',async(req,res)=>res.json((await db.query('SELECT * FROM generated_documents WHERE id::text=$1',[req.params.id])).rows[0]));
      app.put('/api/entities/GeneratedDocument/:id',(req,res)=>res.json({unexpectedBypass:true}));
      app.post('/api/entities/GeneratedDocument',(req,res)=>res.json({unexpectedBypass:true}));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,who='admin',method='GET',body)=>fetch(base+path,{method,headers:{...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/api/gan/documents/'+first.document.id,null)).status,401);
      assert.equal((await call('/api/gan/documents/'+first.document.id,'user')).status,403);
      const response=await call('/api/gan/documents/'+first.document.id+'/pdf?revision=1'),pdf=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.deepEqual(pdf,original.pdf);assert.equal(response.headers.get('cache-control'),'private, no-store');
      const metadata=await(await call('/api/gan/documents/'+first.document.id)).json();assert.equal(metadata.pdf,undefined);assert.equal(metadata.history.length,3);
      const generic=await(await call('/api/entities/GeneratedDocument/'+first.document.id)).json();assert.equal(generic.gan_pdf,undefined);assert.equal(generic.gan_snapshot,undefined);
      const filtered=await call('/api/entities/GeneratedDocument/filter','admin','POST',{filter:{application_id:ids.app},limit:1});assert.equal(filtered.status,200);const filteredRows=await filtered.json();assert.equal(filteredRows.length,1);assert.equal(filteredRows[0].id,first.document.id);assert.equal(filteredRows[0].gan_pdf,undefined);assert.equal(filteredRows[0].gan_snapshot,undefined);
      assert.equal((await call('/api/entities/GeneratedDocument/filter','admin','POST',{filter:{gan_pdf:'private'}})).status,400);
      assert.equal((await call('/api/entities/GeneratedDocument?sort=-gan_snapshot')).status,400);
      assert.equal((await call('/api/entities/GeneratedDocument/'+first.document.id,'user')).status,403);
      const list=await(await call('/api/entities/GeneratedDocument','otherUser')).json();assert.ok(!list.some(row=>row.gan_managed));
      assert.equal((await call('/api/entities/GeneratedDocument/'+first.document.id,'admin','PUT',{status:'Sent'})).status,403);
      assert.equal((await call('/api/entities/GeneratedDocument','admin','POST',{doc_type:'Grant Award Notice'})).status,403);
      assert.equal((await call('/api/entities/GeneratedDocument','admin','POST',{'"gan_pdf"':'forged'})).status,400);
      const payload=request(),generated=await call('/api/gan/applications/'+ids.secondApp+'/draft','admin','POST',payload);assert.equal(generated.status,201);
      const newId=(await generated.json()).document.id;assert.equal((await call('/api/gan/documents/'+newId)).status,200);
      const auditCount=await count('audit_logs'),retry=await call('/api/gan/applications/'+ids.secondApp+'/draft','admin','POST',payload);assert.equal(retry.status,200);assert.equal((await retry.json()).document.id,newId);assert.equal(await count('audit_logs'),auditCount);
    });
    await t.test('A recipient reassignment requires reconciliation instead of moving a stored GAN',async()=>{
      await db.query('UPDATE applications SET organization_id=$2 WHERE id=$1',[ids.app,ids.otherOrg]);
      await assert.rejects(readGanDraft(db,ids.isc,first.document.id),{status:409});
      await assert.rejects(saveGanDraft(db,ids.isc,ids.app,request(3)),{status:409});
      await db.query('UPDATE applications SET organization_id=$2 WHERE id=$1',[ids.app,ids.org]);
    });
    await t.test('A sent-state fixture keeps its snapshot and rejects regeneration even after its source changes',async()=>{
      // Only this disposable fixture simulates the future send transition. No send action exists yet.
      assert.match(schema,/^gmt_qa_gan_drafts_\d+$/);assert.equal((await db.query('SELECT current_schema() AS name')).rows[0].name,schema);
      await db.query('ALTER TABLE generated_documents DISABLE TRIGGER protect_gan_document');
      try{await db.query("UPDATE generated_documents SET status='Sent' WHERE id=$1",[first.document.id]);}finally{await db.query('ALTER TABLE generated_documents ENABLE TRIGGER protect_gan_document');}
      const before=await readGanDraft(db,ids.admin,first.document.id);
      await db.query("UPDATE organizations SET name='QA changed after send' WHERE id=$1",[ids.org]);
      await assert.rejects(save(request(3)),{status:409});
      assert.deepEqual((await readGanDraft(db,ids.official,first.document.id)).pdf,before.pdf);
      const client=await db.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','draft',true)");await assert.rejects(client.query('UPDATE generated_documents SET gan_revision=gan_revision+1 WHERE id=$1',[first.document.id]),{code:'42501'});}finally{await client.query('ROLLBACK');client.release();}
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
