import JSZip from 'jszip';
import {createAuditPackageRouter} from '../routes/auditPackage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import live from '../db/connection.js';
import {migrateAccountAccess} from '../services/accountMigration.js';
import {migrateNofoForms} from '../services/forms/formMigration.js';
import {migrateEhp} from '../services/ehp/ehpMigration.js';
import {readEhp,classifyEhpBudget,recordEhpDecision} from '../services/ehp/ehpReview.js';
import {submitFundingRequest} from '../services/ehp/fundingSubmit.js';
import {mutateFunding} from '../services/ehp/fundingMutations.js';
import {saveFormApplication} from '../services/forms/applicationFormSave.js';
import {createEhpRouter} from '../routes/ehp.js';
import {createFundingRequestRouter,createFundingEntityRouter} from '../routes/fundingRequests.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
test('EHP approval and funding holds use scoped, atomic server operations',async t=>{
  const schema='gmt_qa_ehp_'+Date.now();await live.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  const ids=Object.fromEntries(['org','otherOrg','admin','otherAdmin','isc','user','reviewer','app','otherApp','affected','unaffected','unknown','foreign'].map(key=>[key,randomUUID()]));
  const tableNames=['users','organizations','grantees','audit_logs','applications','notifications','documents','application_reviews','review_comments','grant_programs','nofos','application_budgets','funding_requests','funding_request_line_items'];
  const getApp=async()=> (await db.query('SELECT * FROM applications WHERE id=$1',[ids.app])).rows[0];
  const getReview=()=>readEhp(db,ids.admin,ids.app);
  const decide=async(decision='Approved',extra={})=>recordEhpDecision(db,ids.admin,ids.app,{decision,reference:'QA FEMA approval reference',date:'2026-10-01',notes:'Synthetic QA decision',expectedRevision:(await getApp()).ehp_review_revision,...extra});
  const classify=async(lineId,affected)=>classifyEhpBudget(db,ids.admin,ids.app,lineId,{affected,expectedRevision:(await getApp()).ehp_review_revision});
  const request=(budgetId=ids.unaffected,extra={})=>({application_id:ids.app,request_type:'Reimbursement',period_start:'2026-10-01',period_end:'2026-10-10',match_documented:0,lines:[{budget_category:'Equipment',description:'QA expense',amount_requested:'10.00',application_budget_id:budgetId,ehp_affected:false}],attachments:[],...extra});
  try {
    for(const name of tableNames)await db.query('CREATE TABLE '+name+' (LIKE public.'+name+' INCLUDING ALL)');
    await migrateAccountAccess(db);await migrateNofoForms(db);await migrateEhp(db);await migrateEhp(db);
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA NE EHP Org','County','NE'),($2,'QA IL EHP Org','County','IL')",[ids.org,ids.otherOrg]);
    for(const [key,role,state,org] of [['admin','admin','NE',null],['otherAdmin','admin','IL',null],['isc','isc_admin','',null],['user','user','NE',ids.org],['reviewer','reviewer','NE',null]])
      await db.query("INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status) VALUES($1,$2,$2,'synthetic-not-a-login-hash',$3,$4,$5,'active')",[ids[key],key+'@ehp-qa.invalid',role,state,org]);
    await db.query(`INSERT INTO applications(id,organization_id,organization_name,status,project_title,application_number,ehp_required,ehp_status,ehp_screening_answers)
      VALUES($1,$2,'QA NE EHP Org','Approved','QA affected project','APP-QA-EHP',true,'ScreeningRequired','{"q1":"unknown"}'),
      ($3,$4,'QA IL EHP Org','Approved','QA other project','APP-QA-OTHER',false,'NotRequired','{}')`,[ids.app,ids.org,ids.otherApp,ids.otherOrg]);
    for(const [key,app] of [['affected',ids.app],['unaffected',ids.app],['unknown',ids.app],['foreign',ids.otherApp]])
      await db.query("INSERT INTO application_budgets(id,application_id,budget_category,line_description,amount_requested,amount_match) VALUES($1,$2,'Equipment',$3,100,0)",[ids[key],app,'QA '+key+' cost']);
    await t.test('Only assigned admins classify costs or record approval; stale edits and foreign lines are rejected',async()=>{
      await assert.rejects(readEhp(db,ids.otherAdmin,ids.app),{status:403});
      for(const actor of [ids.user,ids.reviewer,ids.otherAdmin])await assert.rejects(recordEhpDecision(db,actor,ids.app,{decision:'Approved',expectedRevision:0}),{status:403});
      await assert.rejects(classifyEhpBudget(db,ids.admin,ids.app,ids.foreign,{affected:true,expectedRevision:0}),{status:404});
      await classify(ids.affected,true);await classify(ids.unaffected,false);
      await assert.rejects(classifyEhpBudget(db,ids.admin,ids.app,ids.unknown,{affected:false,expectedRevision:0}),{status:409});
      await assert.rejects(decide('Approved',{date:'2026-02-31'}),{status:400});
      await assert.rejects(decide('Approved',{reference:''}),{status:400});
    });
    await t.test('Affected, unknown, foreign and unlinked lines block atomically; unaffected lines can submit',async()=>{
      for(const budget of [ids.affected,ids.unknown,ids.foreign,null])await assert.rejects(submitFundingRequest(db,ids.user,request(budget)),{status:422});
      assert.equal((await db.query('SELECT count(*) FROM funding_requests')).rows[0].count,'0');
      assert.equal((await db.query('SELECT count(*) FROM funding_request_line_items')).rows[0].count,'0');
      const saved=await submitFundingRequest(db,ids.user,request());
      assert.equal(saved.status,'Submitted');assert.equal(Number(saved.amount_requested),10);
      assert.equal((await db.query('SELECT count(*) FROM funding_request_line_items WHERE funding_request_id=$1',[saved.id])).rows[0].count,'1');
      const recipients=(await db.query('SELECT user_email FROM notifications WHERE entity_id=$1',[saved.id])).rows.map(row=>row.user_email);
      assert.ok(recipients.includes('admin@ehp-qa.invalid'));assert.ok(recipients.includes('reviewer@ehp-qa.invalid'));assert.ok(!recipients.includes('otherAdmin@ehp-qa.invalid'));
    });
    await t.test('Missing files and invalid amounts roll back headers, lines, audit and notifications',async()=>{
      const count=async table=>Number((await db.query('SELECT count(*) FROM '+table)).rows[0].count);
      const before=await Promise.all(['funding_requests','funding_request_line_items','audit_logs','notifications'].map(count));
      await assert.rejects(submitFundingRequest(db,ids.user,request(ids.unaffected,{attachments:[{name:'QA Invoice',url:'/api/files/missing.pdf'}]}),async()=>false),{status:422});
      await assert.rejects(submitFundingRequest(db,ids.user,request(ids.unaffected,{lines:[{description:'QA invalid',amount_requested:'-10',application_budget_id:ids.unaffected}]})),{status:422});
      assert.deepEqual(await Promise.all(['funding_requests','funding_request_line_items','audit_logs','notifications'].map(count)),before);
    });
    await t.test('Approval records reference, date, actor and immutable history; affected costs then submit',async()=>{
      const context=await decide();assert.equal(context.application.ehp_status,'Approved');assert.equal(context.history.length,1);
      assert.equal(context.history[0].recorded_by,'admin@ehp-qa.invalid');assert.equal(context.history[0].approval_reference,'QA FEMA approval reference');
      const saved=await submitFundingRequest(db,ids.user,request(ids.affected));assert.equal(saved.status,'Submitted');
      assert.equal((await db.query('SELECT ehp_affected FROM funding_request_line_items WHERE funding_request_id=$1',[saved.id])).rows[0].ehp_affected,true);
      const before=context.application.ehp_review_revision;await decide('ScreeningRequired');
      await assert.rejects(recordEhpDecision(db,ids.admin,ids.app,{decision:'Approved',expectedRevision:before,reference:'QA stale',date:'2026-10-01'}),{status:409});
      assert.equal((await getReview()).history.length,2);
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',saved.id,{status:'Approved'}),{status:422});
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',saved.id,{payment_status:'Paid'}),{status:422});
      await assert.rejects(mutateFunding(db,ids.user,'FundingRequestLineItem',(await db.query('SELECT id FROM funding_request_line_items WHERE funding_request_id=$1',[saved.id])).rows[0].id,{ehp_affected:false}),{status:409});
      await decide();await mutateFunding(db,ids.admin,'FundingRequest',saved.id,{status:'Approved'});
    });
    await t.test('Classification changes reopen approval and generic application writes cannot forge approval',async()=>{
      await classify(ids.unknown,false);assert.equal((await getApp()).ehp_status,'ScreeningRequired');assert.equal((await getApp()).ehp_approval_date,null);
      await assert.rejects(saveFormApplication(db,ids.admin,ids.app,{ehp_status:'Approved'}),{status:403});
      await assert.rejects(saveFormApplication(db,ids.admin,ids.app,{ehp_approval_date:'2026-10-01'}),{status:403});
      await assert.rejects(saveFormApplication(db,ids.admin,ids.app,{ehp_review_revision:500}),{status:403});
      const app=await saveFormApplication(db,ids.admin,ids.app,{ehp_required:false});assert.equal(app.ehp_required,true);
    });
    await t.test('Generic funding writes enforce scope and cannot submit incomplete headers or release held lines',async()=>{
      await assert.rejects(mutateFunding(db,ids.user,'FundingRequest',null,{application_id:ids.app,request_type:'Reimbursement',status:'Submitted'}),{status:400});
      await assert.rejects(submitFundingRequest(db,ids.otherAdmin,request()),{status:403});
      const draft=await mutateFunding(db,ids.user,'FundingRequest',null,{application_id:ids.app,request_type:'Reimbursement',status:'Draft'});
      await assert.rejects(mutateFunding(db,ids.user,'FundingRequest',draft.id,{status:'Submitted'}),{status:422});
      const line=await mutateFunding(db,ids.user,'FundingRequestLineItem',null,{funding_request_id:draft.id,budget_category:'Equipment',description:'QA draft affected',amount_requested:10,application_budget_id:ids.affected,ehp_affected:false});
      await assert.rejects(mutateFunding(db,ids.user,'FundingRequest',draft.id,{status:'Submitted'}),{status:422});
      await assert.rejects(mutateFunding(db,ids.otherAdmin,'FundingRequestLineItem',line.id,{description:'QA attack'}),{status:403});
      await mutateFunding(db,ids.user,'FundingRequestLineItem',line.id,{},'DELETE');await mutateFunding(db,ids.user,'FundingRequest',draft.id,{},'DELETE');
    });
    await t.test('Approval balance changes are atomic and repeated approval/payment edits do not double count',async()=>{
      await db.query('UPDATE applications SET awarded_amount=1000,total_expended=0,remaining_balance=1000 WHERE id=$1',[ids.app]);
      const saved=await submitFundingRequest(db,ids.user,request());
      await mutateFunding(db,ids.admin,'FundingRequest',saved.id,{status:'Approved',amount_approved:9});
      assert.equal(Number((await getApp()).total_expended),9);assert.equal(Number((await getApp()).remaining_balance),991);
      await mutateFunding(db,ids.admin,'FundingRequest',saved.id,{status:'Approved',amount_approved:9});
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',saved.id,{payment_status:'Paid'}),{status:422});
      await mutateFunding(db,ids.admin,'FundingRequest',saved.id,{payment_status:'Paid',payment_method:'EFT',amount_paid:9});
      assert.equal(Number((await getApp()).total_expended),9);
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',saved.id,{request_type:'Modification'}),{status:400});
      const before=await getApp();
      await decide();const affected=await submitFundingRequest(db,ids.user,request(ids.affected));await decide('ScreeningRequired');
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',affected.id,{status:'Approved',amount_approved:10}),{status:422});
      assert.equal(Number((await getApp()).total_expended),Number(before.total_expended));
      await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',affected.id,{payment_status:'ReadyForPayment'}),{status:422});
    });
    await t.test('Admins can require review for a newly identified cost even without screening triggers',async()=>{
      const current=(await db.query('SELECT * FROM applications WHERE id=$1',[ids.otherApp])).rows[0];
      const manual=await recordEhpDecision(db,ids.otherAdmin,ids.otherApp,{decision:'ScreeningRequired',notes:'QA newly identified installation',expectedRevision:current.ehp_review_revision});
      assert.equal(manual.application.ehp_manual_required,true);
      const edited=await saveFormApplication(db,ids.otherAdmin,ids.otherApp,{reviewer_notes:'QA note'});
      assert.equal(edited.ehp_required,true);assert.equal(edited.ehp_status,'ScreeningRequired');
      await assert.rejects(saveFormApplication(db,ids.otherAdmin,ids.otherApp,{ehp_manual_required:false}),{status:403});
    });
    await t.test('Concurrent unaffected submissions get distinct request numbers',async()=>{
      const results=await Promise.all([submitFundingRequest(db,ids.user,request()),submitFundingRequest(db,ids.user,request())]);
      assert.notEqual(results[0].request_number,results[1].request_number);
    });
    await t.test('Concurrent EHP decisions reject a stale administrator and release checks serialize with reopening',async()=>{
      const revision=(await getApp()).ehp_review_revision;
      const decisions=await Promise.allSettled(['Approved','ScreeningRequired'].map(decision=>recordEhpDecision(db,ids.admin,ids.app,{decision,reference:'QA concurrent approval',date:'2026-10-01',notes:'QA concurrent decision',expectedRevision:revision})));
      assert.equal(decisions.filter(row=>row.status==='fulfilled').length,1);assert.equal(decisions.find(row=>row.status==='rejected').reason.status,409);
      await decide();const before=Number((await db.query('SELECT count(*) FROM funding_requests')).rows[0].count);
      const results=await Promise.allSettled([submitFundingRequest(db,ids.user,request(ids.affected)),decide('ScreeningRequired')]);
      assert.equal(results[1].status,'fulfilled');assert.equal((await getApp()).ehp_status,'ScreeningRequired');
      const after=Number((await db.query('SELECT count(*) FROM funding_requests')).rows[0].count);
      if(results[0].status==='fulfilled'){assert.equal(after,before+1);await assert.rejects(mutateFunding(db,ids.admin,'FundingRequest',results[0].value.id,{status:'Approved'}),{status:422});}
      else{assert.equal(results[0].reason.status,422);assert.equal(after,before);}
    });
    await t.test('HTTP routes use authentication and enforce the same EHP and funding boundaries',async()=>{
      const app=express();app.use(express.json());const auth=createAuthentication(db);
      app.use('/api/ehp',createEhpRouter(db,auth));app.use('/api/funding-requests',createFundingRequestRouter(db,auth,async()=>true));app.use('/api/entities',createFundingEntityRouter(db,auth));app.use('/api/functions',createAuditPackageRouter(db,auth));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=async(path,method='GET',body,actor)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+generateToken({id:ids[actor]})}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/api/ehp/applications/'+ids.app)).status,401);
      assert.equal((await call('/api/ehp/applications/'+ids.app+'/decision','PUT',{decision:'Approved'},'user')).status,403);
      assert.equal((await call('/api/funding-requests/submit','POST',request(ids.affected),'user')).status,422);
      assert.equal((await call('/api/entities/FundingRequest','POST',{application_id:ids.app,status:'Submitted',request_type:'Reimbursement'},'user')).status,400);
      assert.equal((await call('/api/funding-requests/submit','POST',request(),'user')).status,201);
      const response=await call('/api/functions/exportAuditPackage','POST',{application_id:ids.app},'admin');assert.equal(response.status,200);
      const zip=await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
      const decisionFile=Object.keys(zip.files).find(name=>name.endsWith('/ehp_decisions.json'));
      const decisions=JSON.parse(await zip.file(decisionFile).async('string'));assert.ok(decisions.some(row=>row.approval_reference==='QA FEMA approval reference'));
      const lineFile=Object.keys(zip.files).find(name=>name.endsWith('/funding_request_line_items.json'));
      assert.ok(JSON.parse(await zip.file(lineFile).async('string')).some(row=>row.application_budget_id===ids.affected));
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();
  }
});
