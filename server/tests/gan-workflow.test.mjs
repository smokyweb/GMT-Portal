import {readGanSendReadiness} from '../services/documents/ganIssueReadiness.js';
import {listGanWorkflows} from '../services/documents/ganWorkflowCatalog.js';
import {GAN_SIGNATURE_CONSENTS} from '../services/documents/ganWorkflowPolicy.js';
import {assertGanFundingReady} from '../services/documents/ganFundingGate.js';
import {submitFundingRequest} from '../services/ehp/fundingSubmit.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import express from 'express';
import {PDFDocument} from 'pdf-lib';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {migrateGanSettings} from '../services/documents/ganSettingsMigration.js';
import {migrateGanPackages} from '../services/documents/ganPackageMigration.js';
import {migrateGanWorkflow} from '../services/documents/ganWorkflowMigration.js';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {readGanDraft} from '../services/documents/ganDraftRead.js';
import {saveGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
import {transitionGan} from '../services/documents/ganWorkflow.js';
import {readGanWorkflow,readGanIssuePdf} from '../services/documents/ganWorkflowRead.js';
import {saveGanSignatureSettings} from '../services/documents/ganSignatureSettings.js';
import {createGanWorkflowRouter} from '../routes/ganWorkflow.js';
import {createGanWorkflowNotificationAccess} from '../middleware/ganWorkflowNotificationAccess.js';
import {createGanWorkflowRuleAccess} from '../middleware/ganWorkflowRuleAccess.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
import {ganPackageHash} from '../services/documents/ganPackagePolicy.js';
test('Owned GAN issuance, recipient review/sign/reject and immutable evidence',async t=>{
  const schema='gmt_qa_gan_workflow_'+Date.now();assert.match(schema,/^gmt_qa_gan_workflow_\d+$/);await live.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  try{
    const {ids,selection}=await seedGanDraftDatabase(db,schema);for(const table of ['notifications','workflow_rules'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    await migrateGanSettings(db);await migrateGanPackages(db);await migrateGanWorkflow(db);
    await db.query('UPDATE users SET full_name=$2 WHERE id=$1',[ids.official,'María García']);
    const pdf=await PDFDocument.create();pdf.addPage([612,792]).drawText('QA CONDITIONS — NOT CLIENT LEGAL TEXT'.replace('—','-'),{x:40,y:700});const bytes=Buffer.from(await pdf.save());
    const conditions=(await saveGanAttachment(db,ids.admin,ids.nofo,{requestId:randomUUID(),kind:'special_conditions',title:'QA Conditions',signaturePages:[1]},bytes)).attachment;
    const drafts={};
    async function make(key='app',expected=0){
      const doc=(await saveGanDraft(db,ids.admin,ids[key],{requestId:randomUUID(),expectedRevision:expected,...selection})).document;
      const old=(await db.query('SELECT COALESCE(MAX(package_revision),0)::int AS n FROM gan_package_snapshots WHERE document_id=$1',[doc.id])).rows[0].n;
      const pack=(await saveGanPackage(db,ids.admin,doc.id,{requestId:randomUUID(),expectedGanRevision:doc.revision,expectedPackageRevision:old,conditionsId:conditions.id})).package;
      return drafts[key]={doc,pack};
    }
    const request=revision=>({requestId:randomUUID(),expectedRevision:revision});
    const send=async(key='app',revision=0,actor=ids.admin,override={})=>transitionGan(db,actor,drafts[key].doc.id,'send',{...request(revision),packageId:drafts[key].pack.id,...override},'127.0.0.1');
    const act=(key,action,revision,extra={},actor=ids.official)=>transitionGan(db,actor,drafts[key].doc.id,action,{...request(revision),...extra},'203.0.113.9');
    const counts=async()=>({events:(await db.query('SELECT count(*)::int AS n FROM gan_workflow_events')).rows[0].n,delivery:(await db.query('SELECT count(*)::int AS n FROM gan_workflow_delivery')).rows[0].n,alerts:(await db.query('SELECT count(*)::int AS n FROM notifications WHERE gan_workflow_event_id IS NOT NULL')).rows[0].n});
    let sent,signed;
    await t.test('Migration is idempotent and only creates isolated workflow state',async()=>{
      await migrateGanWorkflow(db);assert.equal((await db.query("SELECT to_regclass('public.gan_workflows') AS workflow")).rows[0].workflow,null);
      await make();assert.equal((await readGanWorkflow(db,ids.admin,drafts.app.doc.id)).phase,'Draft');
      await assert.rejects(readGanWorkflow(db,ids.official,drafts.app.doc.id),{status:403});
    });
    await t.test('Send readiness is read-only, administrator scoped, and checks the exact saved sources',async()=>{
      const before=await counts(),audit=(await db.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n;
      const checked=await readGanSendReadiness(db,ids.admin,drafts.app.doc.id,drafts.app.pack.id);
      assert.equal(checked.ready,true);assert.equal(checked.recipient.id,ids.official);assert.deepEqual(await counts(),before);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n,audit);
      for(const who of [ids.official,ids.user,ids.otherAdmin])await assert.rejects(readGanSendReadiness(db,who,drafts.app.doc.id,drafts.app.pack.id),{status:403});
      await db.query("UPDATE organizations SET address='QA readiness stale' WHERE id=$1",[ids.org]);
      await assert.rejects(readGanSendReadiness(db,ids.admin,drafts.app.doc.id,drafts.app.pack.id),{status:409});
      await db.query("UPDATE organizations SET address='100 Test Road' WHERE id=$1",[ids.org]);
      assert.deepEqual((await listGanWorkflows(db,ids.official)).documents,[]);
    });
    await t.test('Sending rejects unauthorized users, a mismatched package and changed source fields without leaving partial state',async()=>{
      for(const invalid of ['upload','constructor','__proto__'])await assert.rejects(transitionGan(db,ids.admin,drafts.app.doc.id,invalid,request(0)),{status:400});
      for(const actor of [ids.user,ids.official,ids.reviewer,ids.otherAdmin])await assert.rejects(send('app',0,actor),{status:403});
      await make('secondApp');await assert.rejects(send('app',0,ids.admin,{packageId:drafts.secondApp.pack.id}),{status:409});
      await db.query("UPDATE organizations SET address='QA changed address' WHERE id=$1",[ids.org]);await assert.rejects(send(),{status:409});
      assert.deepEqual(await counts(),{events:0,delivery:0,alerts:0});await db.query("UPDATE organizations SET address='100 Test Road' WHERE id=$1",[ids.org]);
    });
    await t.test('Sending records one immutable issued package and queues required-party alerts without provider delivery',async()=>{
      sent=await send();assert.equal(sent.phase,'Sent');assert.equal(sent.fullyExecuted,false);assert.equal(sent.delivery.providerDeliveryVerified,false);
      assert.deepEqual(await counts(),{events:1,delivery:1,alerts:1});const current=await readGanWorkflow(db,ids.official,drafts.app.doc.id);assert.equal(current.phase,'Sent');assert.equal(current.issue.recipient_id,ids.official);
      const issued=await readGanIssuePdf(db,ids.official,sent.issue.id);assert.equal(issued.stage,'Issued');assert.equal(ganPackageHash(issued.pdf),sent.issue.pdf_sha256);
      const row=(await db.query('SELECT * FROM generated_documents WHERE id=$1',[drafts.app.doc.id])).rows[0];assert.equal(row.status,'Sent');assert.equal(row.gan_pdf_sha256,drafts.app.doc.pdf_sha256);assert.equal(row.signed_at,null);await assert.rejects(readGanDraft(db,ids.official,drafts.app.doc.id),{status:403});
      fs.mkdirSync('../output/pdf/gan-workflow',{recursive:true});fs.writeFileSync('../output/pdf/gan-workflow/qa-issued.pdf',issued.pdf);
    });
    await t.test('Award catalog exposes only issued GANs authorized to the named official or assigned administrator',async()=>{
      for(const who of [ids.official,ids.admin,ids.isc]){
        const catalog=await listGanWorkflows(db,who);assert.equal(catalog.documents.length,1);assert.equal(catalog.documents[0].id,drafts.app.doc.id);
        assert.equal(catalog.documents[0].applicationNumber,'APP-2026-00101');assert.equal(catalog.documents[0].fullyExecuted,false);
      }
      for(const who of [ids.user,ids.otherUser,ids.otherAdmin])assert.deepEqual((await listGanWorkflows(db,who)).documents,[]);
      assert.equal((await listGanWorkflows(db,ids.reviewer)).documents[0].id,drafts.app.doc.id);
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.official]);await assert.rejects(listGanWorkflows(db,ids.official),{status:401});
      await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.official]);
    });
    await t.test('Only the named active official can open or sign, and review precedes signature',async()=>{
      for(const actor of [ids.user,ids.otherUser,ids.admin,ids.reviewer])await assert.rejects(act('app','open',1,{},actor),{status:403});
      await assert.rejects(act('app','sign',1,{name:'María García',title:'QA Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:sent.issue.pdf_sha256}),{status:409});
      await assert.rejects(readGanIssuePdf(db,ids.user,sent.issue.id),{status:403});await assert.rejects(readGanIssuePdf(db,ids.otherAdmin,sent.issue.id),{status:403});
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.official]);await assert.rejects(act('app','open',1),{status:401});await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.official]);
    });
    await t.test('First review and repeated opens retain audit while only the first review queues a notice',async()=>{
      const opened=await act('app','open',1);assert.equal(opened.phase,'Reviewed');assert.equal(opened.event.evidence.firstOpen,true);
      assert.deepEqual(await counts(),{events:2,delivery:2,alerts:2});await act('app','open',2);assert.deepEqual(await counts(),{events:3,delivery:2,alerts:2});
    });
    await t.test('Signature requires all consents, exact issued hash and the named official identity',async()=>{
      const good={name:'María García',title:'QA Authorized Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:sent.issue.pdf_sha256};
      for(const field of ['consentElectronic','consentConditions','consentAuthority'])await assert.rejects(act('app','sign',3,{...good,[field]:false}),{status:400});
      await assert.rejects(act('app','sign',3,{...good,issuedPdfSha256:'0'.repeat(64)}),{status:409});await assert.rejects(act('app','sign',3,{...good,name:'Not this official'}),{status:400});
      const client=await db.connect();try{
        await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','workflow',true)");
        const eventId=randomUUID(),at=new Date().toISOString(),evidence={consentVersion:'gmt-gan-electronic-v1',name:good.name,title:good.title,actorId:ids.official,actorEmail:'official@gan-draft-qa.invalid',issueId:sent.issue.id,eventId,signedAt:at,ip:'127.0.0.1',issuedPdfSha256:sent.issue.pdf_sha256,consents:GAN_SIGNATURE_CONSENTS,confirmed:{electronic:true,conditions:true,authority:true}};
        await assert.rejects(client.query("INSERT INTO gan_workflow_events(id,document_id,issue_id,revision,request_id,request_sha256,action,from_phase,to_phase,actor_id,actor_role,actor_email,occurred_at,ip,evidence,evidence_sha256,pdf,pdf_sha256) VALUES($1,$2,$3,4,$4,'synthetic','sign','Reviewed','RecipientSigned',$5,'user','official@gan-draft-qa.invalid',$6,'127.0.0.1',$7,encode(sha256(convert_to($7::jsonb::text,'UTF8')),'hex'),$8,NULL)",[eventId,drafts.app.doc.id,sent.issue.id,randomUUID(),ids.official,at,JSON.stringify(evidence),Buffer.from('unsigned synthetic bytes')]),{code:'23514'});
      }finally{await client.query('ROLLBACK');client.release();}
      signed=await act('app','sign',3,good);assert.equal(signed.phase,'RecipientSigned');assert.equal(signed.fullyExecuted,false);assert.equal(signed.event.evidence.actorId,ids.official);assert.equal(signed.event.evidence.ip,'203.0.113.9');
      const artifact=await readGanIssuePdf(db,ids.official,sent.issue.id);assert.equal(artifact.stage,'RecipientSigned');assert.equal((await PDFDocument.load(artifact.pdf)).getPageCount(),3);
      fs.writeFileSync('../output/pdf/gan-workflow/qa-recipient-signed.pdf',artifact.pdf);
      fs.writeFileSync('../output/pdf/gan-workflow/qa-signature-evidence.json',JSON.stringify(signed.event.evidence,null,2));
      assert.equal((await db.query('SELECT status FROM generated_documents WHERE id=$1',[drafts.app.doc.id])).rows[0].status,'Signed');
      assert.equal((await readGanWorkflow(db,ids.admin,drafts.app.doc.id)).phase,'RecipientSigned');
      await assert.rejects(make('app',1),{status:409});await assert.rejects(act('app','reject',4,{note:'too late'}),{status:409});
    });
    await t.test('Rejected packages require notes, keep old issues, and can be regenerated and reissued atomically',async()=>{
      const sentTwo=await send('secondApp');await act('secondApp','open',1);await assert.rejects(act('secondApp','reject',2,{note:'  '}),{status:400});
      await act('secondApp','reject',2,{note:'Correct the award scope.'});assert.equal((await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id)).phase,'Rejected');
      const original=await readGanIssuePdf(db,ids.official,sentTwo.issue.id);
      await make('secondApp',1);assert.equal((await readGanWorkflow(db,ids.admin,drafts.secondApp.doc.id)).phase,'Draft');
      assert.equal((await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id)).phase,'Rejected');
      assert.deepEqual((await readGanIssuePdf(db,ids.official,sentTwo.issue.id)).pdf,original.pdf);
      await assert.rejects(readGanDraft(db,ids.official,drafts.secondApp.doc.id),{status:403});
      const resent=await send('secondApp',3);assert.equal(resent.revision,4);assert.notEqual(resent.issue.id,sentTwo.issue.id);
    });
    await t.test('The database refuses to commit a standalone event without matching current state and document metadata',async()=>{
      const state=await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id),client=await db.connect();
      try{
        await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','workflow',true)");
        await client.query("INSERT INTO gan_workflow_events(id,document_id,issue_id,revision,request_id,request_sha256,action,from_phase,to_phase,actor_id,actor_role,actor_email,occurred_at,ip,evidence,evidence_sha256) VALUES($1,$2,$3,$4,$5,'synthetic','open','Sent','Reviewed',$6,'user','official@gan-draft-qa.invalid',NOW(),'127.0.0.1','{}',encode(sha256(convert_to('{}'::jsonb::text,'UTF8')),'hex'))",[randomUUID(),drafts.secondApp.doc.id,state.issue.id,state.revision+1,randomUUID(),ids.official]);
        await assert.rejects(client.query('COMMIT'),{code:'23514'});
      }finally{await client.query('ROLLBACK');client.release();}
      assert.equal((await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id)).revision,state.revision);
    });
    await t.test('Stable request retries cannot repeat events/alerts or accept altered consent input',async()=>{
      const before=await counts(),body={requestId:randomUUID(),expectedRevision:4};const first=await transitionGan(db,ids.official,drafts.secondApp.doc.id,'open',body),again=await transitionGan(db,ids.official,drafts.secondApp.doc.id,'open',body);
      assert.equal(again.replayed,true);assert.equal(again.event.id,first.event.id);const after=await counts();assert.equal(after.events,before.events+1);assert.equal(after.delivery,before.delivery+1);
      await assert.rejects(transitionGan(db,ids.official,drafts.secondApp.doc.id,'reject',{...body,note:'different action'}),{status:409});
    });
    await t.test('Template method settings are ISC-owned, revision-checked and pinned into each issue',async()=>{
      await assert.rejects(saveGanSignatureSettings(db,ids.admin,ids.template,{expectedRevision:0,allowedMethods:['upload']}),{status:403});
      await saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:0,allowedMethods:['upload']});
      await assert.rejects(saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:0,allowedMethods:['electronic']}),{status:409});
      assert.deepEqual((await readGanWorkflow(db,ids.official,drafts.app.doc.id)).issue.allowed_methods,['electronic','upload']);
      await make('legacyApp');const uploadIssue=await send('legacyApp');await act('legacyApp','open',1);
      await assert.rejects(act('legacyApp','sign',2,{name:'María García',title:'QA Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:uploadIssue.issue.pdf_sha256}),{status:403});
    });
    await t.test('Managed GANs remain blocked for funding until NEMA execution; legacy grants retain their current path',async()=>{
      await assert.rejects(assertGanFundingReady(db,ids.app),{status:409});
      await assert.rejects(assertGanFundingReady(db,ids.secondApp),{status:409});
      await assertGanFundingReady(db,randomUUID());
      await assert.rejects(submitFundingRequest(db,ids.official,{application_id:ids.app,request_type:'Reimbursement',period_start:'2026-10-01',period_end:'2026-10-29',lines:[{description:'QA cost',amount_requested:1,application_budget_id:ids.budget}]}),{status:409});
    });
    await t.test('Audit, alert and delivery-queue failures roll back the complete send transaction',async()=>{
      ids.rollbackApp=randomUUID();
      await db.query("INSERT INTO applications SELECT (jsonb_populate_record(NULL::applications,to_jsonb(a)||jsonb_build_object('id',$2::text,'application_number','APP-2026-00104'))).* FROM applications a WHERE id=$1",[ids.app,ids.rollbackApp]);
      await db.query("INSERT INTO award_details SELECT $1,$2,fields||jsonb_build_object('subaward_number','NE-EMPG-2026-004'),revision FROM award_details WHERE application_id=$3",[randomUUID(),ids.rollbackApp,ids.app]);
      await db.query("INSERT INTO application_budgets SELECT (jsonb_populate_record(NULL::application_budgets,to_jsonb(b)||jsonb_build_object('id',$2::text,'application_id',$3::text))).* FROM application_budgets b WHERE id=$1",[ids.budget,randomUUID(),ids.rollbackApp]);
      await make('rollbackApp');const before=await counts(),issuesBefore=(await db.query('SELECT count(*)::int AS n FROM gan_workflow_issues')).rows[0].n;
      for(const marker of ['INSERT INTO audit_logs','INSERT INTO notifications','INSERT INTO gan_workflow_delivery']){
        const faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>sql.includes(marker)?Promise.reject(new Error('synthetic workflow rollback')):client.query(sql,args)};}};
        await assert.rejects(transitionGan(faulty,ids.admin,drafts.rollbackApp.doc.id,'send',{...request(0),packageId:drafts.rollbackApp.pack.id}),/synthetic workflow rollback/);
        assert.deepEqual(await counts(),before);assert.equal((await db.query('SELECT count(*)::int AS n FROM gan_workflow_issues')).rows[0].n,issuesBefore);
        assert.equal((await readGanWorkflow(db,ids.admin,drafts.rollbackApp.doc.id)).phase,'Draft');
      }
    });
    await t.test('A failed signature audit retains the original reviewed state and no signed artifact',async()=>{
      const state=await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id),before=await counts();
      const faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>sql.includes('INSERT INTO audit_logs')?Promise.reject(new Error('synthetic signature rollback')):client.query(sql,args)};}};
      await assert.rejects(transitionGan(faulty,ids.official,drafts.secondApp.doc.id,'sign',{...request(state.revision),name:'María García',title:'QA Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:state.issue.pdf_sha256}),/synthetic signature rollback/);
      assert.deepEqual(await counts(),before);assert.equal((await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id)).phase,'Reviewed');
      assert.equal((await readGanIssuePdf(db,ids.official,state.issue.id)).stage,'Issued');
    });
    await t.test('Concurrent sign/reject actions cannot both succeed from one reviewed revision',async()=>{
      const state=await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id);
      const results=await Promise.allSettled([
        act('secondApp','sign',state.revision,{name:'María García',title:'QA Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:state.issue.pdf_sha256}),
        act('secondApp','reject',state.revision,{note:'Concurrent correction request.'}),
      ]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
      assert.equal((await readGanWorkflow(db,ids.official,drafts.secondApp.doc.id)).revision,state.revision+1);
    });
    await t.test('Existing GAN rule storage controls channels only for named participants, including encoded JSON',async()=>{
      const ruleId=randomUUID();
      await db.query("INSERT INTO workflow_rules(id,name,trigger,trigger_event,action_type,is_active,conditions,actions) VALUES($1,'QA GAN channel','Document Uploaded','GAN Sent','Send Email Notification',true,$2,$3)",
        [ruleId,JSON.stringify(JSON.stringify({recipients:['user']})),JSON.stringify({delivery:'in_app'})]);
      const before=await counts();const result=await send('rollbackApp');assert.equal(result.delivery.emailsQueued,0);assert.equal(result.delivery.inAppCreated,1);
      const after=await counts();assert.equal(after.delivery,before.delivery);assert.equal(after.alerts,before.alerts+1);
      const alerts=(await db.query('SELECT gan_workflow_user_id FROM notifications WHERE gan_workflow_event_id=$1',[result.event.id])).rows;assert.deepEqual(alerts.map(r=>r.gan_workflow_user_id),[ids.official]);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM gan_workflow_delivery WHERE status<>'pending'")).rows[0].n,0);
    });
    await t.test('Later source/profile edits do not change issued or signed PDFs; evidence corruption is detected',async()=>{
      const before=await readGanIssuePdf(db,ids.official,sent.issue.id);
      await db.query("UPDATE organizations SET address='300 Later Road' WHERE id=$1",[ids.org]);await db.query("UPDATE users SET title='Later profile title' WHERE id=$1",[ids.official]);
      assert.deepEqual((await readGanIssuePdf(db,ids.official,sent.issue.id)).pdf,before.pdf);
      const client=await db.connect();try{await client.query('BEGIN');await client.query('ALTER TABLE gan_workflow_events DISABLE TRIGGER protect_gan_workflow_event');
        await client.query("UPDATE gan_workflow_events SET evidence=evidence||'{\"name\":\"forged\"}'::jsonb WHERE id=$1",[signed.event.id]);await assert.rejects(readGanIssuePdf(client,ids.official,sent.issue.id),{status:500});
      }finally{await client.query('ROLLBACK');client.release();}
    });
    await t.test('Issuance and electronic acceptance retain all five project IDs and the attached Schedule',async()=>{
      const oldIssue=(await readGanWorkflow(db,ids.official,drafts.legacyApp.doc.id)).issue;
      await act('legacyApp','reject',2,{note:'QA regenerate for a complete project schedule.'});
      await saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:1,allowedMethods:['electronic','upload']});
      await db.query('CREATE TABLE application_projects(id UUID PRIMARY KEY,application_id TEXT,project_id TEXT,name TEXT,poete TEXT,federal_amount NUMERIC,match_amount NUMERIC)');
      for(let i=1;i<=5;i++)await db.query("INSERT INTO application_projects VALUES($1,$2,$3,$4,'Equipment',100,100)",[randomUUID(),ids.legacyApp,'APP-2026-00103-P'+i,'QA signed schedule project '+i]);
      await make('legacyApp',1);const issued=await send('legacyApp',3);await act('legacyApp','open',4);
      const accepted=await act('legacyApp','sign',5,{name:'María García',title:'QA Authorized Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:issued.issue.pdf_sha256});
      const artifact=await readGanIssuePdf(db,ids.official,issued.issue.id);assert.equal((await PDFDocument.load(artifact.pdf)).getPageCount(),4);assert.equal(accepted.fullyExecuted,false);
      assert.deepEqual((await readGanWorkflow(db,ids.official,drafts.legacyApp.doc.id)).manifest.projects.map(p=>p.project_id),Array.from({length:5},(_,i)=>'APP-2026-00103-P'+(i+1)));
      fs.writeFileSync('../output/pdf/gan-workflow/qa-schedule-recipient-signed.pdf',artifact.pdf);
      const old=(await db.query('SELECT manifest FROM gan_workflow_issues WHERE id=$1',[oldIssue.id])).rows[0];assert.deepEqual(old.manifest.allowed_methods,['upload']);
      await assert.rejects(assertGanFundingReady(db,ids.legacyApp),{status:409});
    });
    await t.test('SQL and generic endpoints cannot forge workflow status, change immutable evidence, or expose another person’s alerts',async()=>{
      for(const [sql,args] of [['UPDATE gan_workflow_events SET evidence=$2 WHERE id=$1',[signed.event.id,'{}']],['DELETE FROM gan_workflow_issues WHERE id=$1',[sent.issue.id]],["UPDATE generated_documents SET status='Draft' WHERE id=$1",[drafts.app.doc.id]],["UPDATE gan_workflows SET phase='Sent' WHERE document_id=$1",[drafts.app.doc.id]]])await assert.rejects(db.query(sql,args),{code:'42501'});
      const app=express(),authenticate=createAuthentication(db);app.use(express.json());app.use('/api/gan',createGanWorkflowRouter(db,authenticate));app.use('/api/entities/:entity/:id?',authenticate,createGanWorkflowNotificationAccess(db),createGanWorkflowRuleAccess(db));app.use('/api/entities',(_req,res)=>res.json({legacy:true}));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,who='official',method='GET',body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/api/gan/documents/'+drafts.app.doc.id+'/workflow',null)).status,401);
      assert.equal((await call('/api/gan/workflow-documents',null)).status,401);
      assert.equal((await call('/api/gan/workflow-documents','reviewer')).status,200);
      const catalog=await (await call('/api/gan/workflow-documents')).json();assert.ok(catalog.documents.some(row=>row.id===drafts.app.doc.id));
      assert.equal((await call('/api/gan/documents/'+drafts.app.doc.id+'/send-readiness?packageId='+drafts.app.pack.id,'official')).status,403);

      assert.equal((await call('/api/gan/issues/'+sent.issue.id+'/pdf','user')).status,403);
      const response=await call('/api/gan/issues/'+sent.issue.id+'/pdf');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(ganPackageHash(Buffer.from(await response.arrayBuffer())),signed.event.pdf_sha256);
      const downloaded=await call('/api/gan/issues/'+sent.issue.id+'/pdf?download=1');assert.equal(downloaded.status,200);assert.ok(downloaded.headers.get('content-disposition').startsWith('attachment;'));
      await downloaded.arrayBuffer();
      const readAudits=(await db.query("SELECT action FROM audit_logs WHERE entity_id=$1 AND action IN ('GANIssuedPackagePreviewed','GANIssuedPackageDownloaded')",[drafts.app.doc.id])).rows.map(row=>row.action);
      assert.ok(readAudits.includes('GANIssuedPackagePreviewed'));assert.ok(readAudits.includes('GANIssuedPackageDownloaded'));
      const preOpen=await readGanWorkflow(db,ids.official,drafts.rollbackApp.doc.id),beforeOpen=await counts();
      assert.equal(preOpen.phase,'Sent');
      const concurrentDownloads=await Promise.all([call('/api/gan/issues/'+preOpen.issue.id+'/pdf'),call('/api/gan/issues/'+preOpen.issue.id+'/pdf')]);
      assert.ok(concurrentDownloads.every(response=>response.status===200));await Promise.all(concurrentDownloads.map(response=>response.arrayBuffer()));
      const afterOpen=await counts();assert.equal(afterOpen.events,beforeOpen.events+1);assert.equal((await readGanWorkflow(db,ids.official,drafts.rollbackApp.doc.id)).phase,'Reviewed');
      await call('/api/gan/issues/'+preOpen.issue.id+'/pdf');assert.equal((await counts()).events,afterOpen.events);
      const filtered=await call('/api/entities/Notification/filter','official','POST',{filter:{user_email:'official@gan-draft-qa.invalid'},sort:'-created_date',limit:1});const limited=await filtered.json();assert.equal(limited.length,1);assert.equal(limited[0].gan_workflow_user_id,ids.official);
      const own=(await (await call('/api/entities/Notification')).json()).filter(row=>row.gan_workflow_event_id);assert.ok(own.length);assert.ok(own.every(row=>row.gan_workflow_user_id===ids.official));
      const foreign=(await db.query('SELECT id FROM notifications WHERE gan_workflow_user_id=$1 LIMIT 1',[ids.admin])).rows[0].id;assert.equal((await call('/api/entities/Notification/'+foreign)).status,404);
      assert.equal((await call('/api/entities/Notification/'+own[0].id,'official','PUT',{is_read:true})).status,200);
      assert.equal((await call('/api/entities/Notification/'+foreign,'official','PUT',{is_read:true})).status,403);
      assert.equal((await call('/api/entities/Notification/'+own[0].id,'official','PUT',{message:'forged'})).status,403);
      assert.equal((await call('/api/entities/WorkflowRule','official','POST',{trigger:'Document Uploaded',trigger_event:'GAN Sent'})).status,403);
      assert.equal((await call('/api/entities/WorkflowRule','isc','POST',{trigger:'Document Uploaded',trigger_event:'GAN Sent'})).status,200);
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
