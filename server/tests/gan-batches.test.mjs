import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {ganBatchCatalog} from '../services/documents/ganBatchCatalog.js';
import {previewGanBatchRows} from '../services/documents/ganBatchPreview.js';
import {migrateGanBatches} from '../services/documents/ganBatchMigration.js';
import {createGanBatch} from '../services/documents/ganBatchPlan.js';
import {readGanBatch} from '../services/documents/ganBatchRead.js';
import {runGanBatch} from '../services/documents/ganBatchRun.js';
import {createGanBatchRouter} from '../routes/ganBatches.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
test('GAN bulk drafts are scoped, durable, pinned and safely resumable',async t=>{
  const schema='gmt_qa_gan_batches_'+Date.now();assert.match(schema,/^gmt_qa_gan_batches_\d+$/);
  await live.query('CREATE SCHEMA '+schema);const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  try {
    const {ids,selection}=await seedGanDraftDatabase(db,schema);await migrateGanBatches(db);
    await db.query('ALTER TABLE nofos ADD COLUMN award_metadata_revision INTEGER NOT NULL DEFAULT 0');
    const request=(changes={})=>({requestId:randomUUID(),nofoId:ids.nofo,templateId:ids.template,granteeId:ids.grantee,officialsByOrganization:{[ids.org]:ids.official},awardDate:selection.awardDate,...changes});
    const plan=(input,who='admin')=>createGanBatch(db,ids[who],input,'127.0.0.1');
    const run=(id,input={},who='admin')=>runGanBatch(db,ids[who],id,input,'127.0.0.1');
    const read=(id,who='admin')=>readGanBatch(db,ids[who],id);
    const count=async table=>Number((await db.query('SELECT count(*) FROM '+table)).rows[0].count);
    let first,initial;
    await t.test('Planning captures its rows/template without generating or silently selecting an official',async()=>{
      initial=request();first=await plan(initial);assert.equal(first.total,3);assert.equal(first.replayed,false);
      const saved=await read(first.id);assert.equal(saved.templateVersion,3);assert.deepEqual(saved.counts,{total:3,pending:3,generated:0,blocked:0,failed:0});
      assert.equal(await count('generated_documents'),0);assert.equal(await count('audit_logs'),1);
      assert.ok(saved.rows.every(row=>row.projectCount===1&&row.requestId&&row.expectedRevision===0));
      await migrateGanBatches(db);assert.equal(await count('gan_draft_batches'),1);
    });
    await t.test('Scoped catalog and readiness previews expose checked rows without saving documents',async()=>{
      const catalog=await ganBatchCatalog(db,ids.admin,ids.nofo);assert.equal(catalog.applications.length,3);assert.ok(catalog.officials.some(user=>user.id===ids.official));assert.ok(!JSON.stringify(catalog).includes('password_hash'));
      const preview=await previewGanBatchRows(db,ids.admin,{...initial,applicationIds:[ids.app]});assert.equal(preview.rows.length,1);assert.equal(preview.rows[0].ready,true);assert.equal(await count('generated_documents'),0);
      const missing=await previewGanBatchRows(db,ids.admin,{...initial,applicationIds:[ids.app],officialsByOrganization:{}});assert.equal(missing.rows[0].ready,false);
      await assert.rejects(previewGanBatchRows(db,ids.admin,{...initial,applicationIds:[randomUUID()]}),{status:403});
      const selected=await plan(request({applicationIds:[ids.secondApp]}));assert.equal(selected.total,1);assert.equal((await read(selected.id)).rows[0].applicationId,ids.secondApp);
      await assert.rejects(plan(request({applicationIds:[randomUUID()]})),{status:403});
    });
    await t.test('Short runs generate ready rows and persist correction reasons for invalid award rows',async()=>{
      await db.query('UPDATE application_budgets SET amount_requested=499 WHERE application_id=$1',[ids.secondApp]);
      await db.query("UPDATE applications SET status='Submitted' WHERE id=$1",[ids.legacyApp]);
      const one=await run(first.id,{limit:1});assert.equal(one.run.processed,1);assert.equal(one.run.remaining,2);assert.equal(one.counts.generated,1);
      const two=await run(first.id,{limit:1});assert.equal(two.counts.blocked,1);assert.ok(two.rows.find(row=>row.applicationId===ids.secondApp).result.details.some(detail=>detail.source.record==='ApplicationBudget'));
      const done=await run(first.id,{limit:1});assert.equal(done.status,'CompletedWithIssues');assert.equal(done.counts.generated,1);assert.equal(done.counts.blocked,2);assert.equal(done.run.remaining,0);
      assert.ok(done.rows.find(row=>row.applicationId===ids.legacyApp).result.details.some(detail=>detail.source.field==='status'));
      assert.equal(await count('gan_document_snapshots'),1);
    });
    await t.test('Batch creation and completed runs are idempotent; changed selections cannot reuse a key',async()=>{
      const before=await count('audit_logs'),again=await plan(initial);assert.equal(again.replayed,true);assert.equal(again.id,first.id);
      await assert.rejects(plan({...initial,awardDate:'2026-10-30'}),{status:409});
      const done=await run(first.id);assert.equal(done.run.processed,0);assert.equal(await count('audit_logs'),before);
    });
    await t.test('An explicit retry pass resumes each blocked row once and does not regenerate successful rows',async()=>{
      await db.query('UPDATE application_budgets SET amount_requested=500 WHERE application_id=$1',[ids.secondApp]);
      await db.query("UPDATE applications SET status='Approved' WHERE id=$1",[ids.legacyApp]);
      assert.equal((await run(first.id)).run.processed,0);
      const retryRequestId=randomUUID(),options={limit:1,retryBlocked:true,retryRequestId};
      const one=await run(first.id,options);assert.equal(one.run.remaining,1);assert.equal(one.counts.generated,2);
      const two=await run(first.id,options);assert.equal(two.status,'Completed');assert.equal(two.run.remaining,0);assert.equal(two.counts.generated,3);
      const again=await run(first.id,options);assert.equal(again.run.processed,0);assert.equal(await count('gan_document_snapshots'),3);
      assert.equal(await count('gan_draft_batch_retry_passes'),1);
    });
    await t.test('Frozen plans exclude applications added later and preserve their original default dates',async()=>{
      const fresh=await plan(request({awardDate:undefined})),saved=(await db.query('SELECT * FROM gan_draft_batches WHERE id=$1',[fresh.id])).rows[0];
      assert.match(saved.selection.awardDate,/^\d{4}-\d{2}-\d{2}$/);assert.ok(saved.selection.dueDate>saved.selection.awardDate);
      const late=randomUUID();await db.query("INSERT INTO applications(id,nofo_id,organization_id,status,application_number) VALUES($1,$2,$3,'Approved','APP-QA-LATE')",[late,ids.nofo,ids.org]);
      assert.equal((await read(fresh.id)).rows.length,3);assert.equal((await plan(request())).total,4);
      await db.query('DELETE FROM applications WHERE id=$1',[late]);
    });
    await t.test('Template versions, template content and NOFO metadata cannot change under an existing plan',async()=>{
      const before=await count('gan_document_snapshots'),versionPlan=await plan(request());
      await db.query('UPDATE document_templates SET version=4 WHERE id=$1',[ids.template]);
      const changed=await run(versionPlan.id,{limit:25});assert.equal(changed.counts.blocked,3);assert.ok(changed.rows.every(row=>row.result.reason.includes('template changed')));
      await db.query('UPDATE document_templates SET version=3 WHERE id=$1',[ids.template]);
      await db.query('UPDATE nofos SET award_metadata_revision=1 WHERE id=$1',[ids.nofo]);
      const metadata=await run(versionPlan.id,{limit:25,retryBlocked:true,retryRequestId:randomUUID()});assert.ok(metadata.rows.every(row=>row.result.reason.includes('NOFO award metadata changed')));
      await db.query('UPDATE nofos SET award_metadata_revision=0 WHERE id=$1',[ids.nofo]);
      const body=(await db.query('SELECT template_body FROM document_templates WHERE id=$1',[ids.template])).rows[0].template_body,bodyPlan=await plan(request());
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,body+'\nChanged terms']);
      assert.ok((await run(bodyPlan.id,{limit:25})).rows.every(row=>row.result.reason.includes('template changed')));
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,body]);assert.equal(await count('gan_document_snapshots'),before);
    });
    await t.test('A lost progress write resumes by replaying the committed draft instead of duplicating it',async()=>{
      const batch=await plan(request()),before=await count('gan_document_snapshots');let failed=false;
      const faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>{
        if(!failed&&sql.includes('INSERT INTO gan_draft_batch_results')){failed=true;return Promise.reject(new Error('synthetic progress failure'));}
        return client.query(sql,args);
      }};}};
      await assert.rejects(runGanBatch(faulty,ids.admin,batch.id,{limit:1}),/synthetic progress failure/);
      assert.equal(await count('gan_document_snapshots'),before+1);assert.equal((await read(batch.id)).counts.pending,3);
      const resumed=await run(batch.id,{limit:1});assert.equal(resumed.counts.generated,1);assert.equal(resumed.rows[0].result.replayed,true);
      assert.equal(await count('gan_document_snapshots'),before+1);
    });
    await t.test('A row-level server failure rolls back that draft, preserves other successes and can be retried',async()=>{
      const batch=await plan(request()),before=await count('gan_document_snapshots');let failed=false;
      const faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>{
        if(!failed&&sql.includes('INSERT INTO audit_logs')&&args?.[2]==='GANDraftGenerated'){failed=true;return Promise.reject(new Error('synthetic database internal detail'));}
        return client.query(sql,args);
      }};}};
      const result=await runGanBatch(faulty,ids.admin,batch.id,{limit:25});assert.equal(result.counts.generated,2);assert.equal(result.counts.failed,1);assert.equal(await count('gan_document_snapshots'),before+2);
      assert.ok(!JSON.stringify(result).includes('synthetic database internal detail'));
      const retried=await run(batch.id,{limit:25,retryBlocked:true,retryRequestId:randomUUID()});assert.equal(retried.counts.generated,3);assert.equal(retried.counts.failed,0);assert.equal(await count('gan_document_snapshots'),before+3);
    });
    await t.test('Concurrent runners cannot hold the same batch, and a later run can resume normally',async()=>{
      const batch=await plan(request()),client=await db.connect();
      try{await client.query("SELECT pg_advisory_lock(hashtext(current_schema()||':gan-batch:'||$1))",[batch.id]);await assert.rejects(run(batch.id),{status:409});}
      finally{await client.query("SELECT pg_advisory_unlock(hashtext(current_schema()||':gan-batch:'||$1))",[batch.id]);client.release();}
      assert.equal((await run(batch.id,{limit:1})).run.processed,1);
    });
    await t.test('Missing officials are blocked explicitly; malformed inputs and unsafe run sizes are rejected',async()=>{
      const empty=await plan(request({officialsByOrganization:{}}));const blocked=await run(empty.id,{limit:25});assert.equal(blocked.counts.blocked,3);
      assert.ok(blocked.rows.every(row=>row.result.details.some(issue=>issue.source.field==='authorized_official_id')));
      for(const changes of [{requestId:'bad'},{awarded_amount:1},{officialsByOrganization:[]},{dueDate:'2026-01-01'}])await assert.rejects(plan(request(changes)),{status:400});
      for(const options of [{limit:0},{limit:26},{retryBlocked:true},{retryRequestId:randomUUID()},{role:'isc_admin'}])await assert.rejects(run(first.id,options),{status:400});
    });
    await t.test('State, role, owner and inactive-account boundaries apply to planning, reading and running',async()=>{
      for(const who of ['user','reviewer','otherAdmin']) {
        await assert.rejects(plan(request(),who),{status:403});await assert.rejects(read(first.id,who),{status:403});await assert.rejects(run(first.id,{},who),{status:403});
      }
      await assert.rejects(read(first.id,'isc'),{status:403});
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.admin]);await assert.rejects(run(first.id),{status:401});await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.admin]);
      const foreign=randomUUID();await db.query("INSERT INTO applications(id,nofo_id,organization_id,status,application_number) VALUES($1,$2,$3,'Approved','APP-IL-ONLY')",[foreign,ids.nofo,ids.otherOrg]);
      const scoped=await plan(request());assert.ok(!(await read(scoped.id)).rows.some(row=>row.applicationId===foreign));
      const global=await plan(request(),'isc');assert.ok((await read(global.id,'isc')).rows.some(row=>row.applicationId===foreign));
      await db.query('DELETE FROM applications WHERE id=$1',[foreign]);
    });
    await t.test('Batch plans/results cannot be changed through generic SQL, and successful results require their actual snapshot',async()=>{
      await assert.rejects(db.query("UPDATE gan_draft_batches SET rows='[]' WHERE id=$1",[first.id]),{code:'42501'});
      await assert.rejects(db.query('DELETE FROM gan_draft_batch_results WHERE batch_id=$1',[first.id]),{code:'42501'});
      await assert.rejects(db.query("UPDATE gan_draft_batch_retry_passes SET rows='[]'"),{code:'42501'});
      const client=await db.connect();
      try{await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','batch-result',true)");
        await assert.rejects(client.query("INSERT INTO gan_draft_batch_results(batch_id,application_id,state,document_id,revision,pdf_sha256,attempts) VALUES($1,$2,'Generated',$3,1,'forged',1) ON CONFLICT(batch_id,application_id) DO UPDATE SET attempts=gan_draft_batch_results.attempts+1,pdf_sha256='forged'",[first.id,ids.app,randomUUID()]),{code:'23514'});
      }finally{await client.query('ROLLBACK');client.release();}
    });
    await t.test('Authenticated HTTP APIs expose metadata/progress, private caching and stable create/retry responses',async()=>{
      const app=express();app.use(express.json());app.use('/api/gan',createGanBatchRouter(db,createAuthentication(db)));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,who='admin',method='GET',body)=>fetch(base+'/api/gan'+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/batches/'+first.id,null)).status,401);assert.equal((await call('/batches/'+first.id,'user')).status,403);
      const payload=request(),created=await call('/batches','admin','POST',payload);assert.equal(created.status,201);const id=(await created.json()).id;
      assert.equal((await call('/batches','admin','POST',payload)).status,200);
      const response=await call('/batches/'+id+'/run','admin','POST',{limit:1}),json=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(json.run.processed,1);
      assert.equal(json.readyForSending,false);assert.ok(!JSON.stringify(json).includes('synthetic-not-a-login-hash'));assert.ok(!JSON.stringify(json).includes('"type":"Buffer"'));
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
