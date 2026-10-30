import {createAuditPackageRouter} from '../routes/auditPackage.js';
import JSZip from 'jszip';
import {createApplicationBudgetAccess} from '../middleware/applicationBudgetAccess.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import livePool from '../db/connection.js';
import {defaultForm,formFields,parseObject} from '../../src/lib/forms/defaultForm.js';
import {validateDefinition} from '../services/forms/definitionPolicy.js';
import {validateFormValues,validateBudget,ehpRequired,valuesForAudience} from '../services/forms/valueValidation.js';
import {migrateAccountAccess} from '../services/accountMigration.js';
import {migrateNofoForms} from '../services/forms/formMigration.js';
import {readNofoForm,saveNofoForm} from '../services/forms/formVersions.js';
import {saveFormApplication,applicationFormContext} from '../services/forms/applicationFormSave.js';
import {createNofoFormsRouter,createFormApplicationRouter} from '../routes/nofoForms.js';
import {createNofoFormEntityAccess} from '../middleware/nofoFormEntityAccess.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
const nofoInput={program_code:'EMPG',match_requirement:null,scope_states:['NE']};
const validData=()=>({
  project_title:'QA EMPG Project',project_narrative:'Synthetic work plan narrative',requested_amount:100,match_amount:100,
  performance_start:'2026-10-01',performance_end:'2027-09-30',empg_work_plan_objectives:'QA objectives',
  empg_match_source:'QA state funds',empg_match_description:'QA match documentation',
  ehp_screening_answers:Object.fromEntries(Array.from({length:10},(_,index)=>['q'+(index+1),'no'])),
  form_values:{cf_empg_personnel:[{name:'QA Staff',position:'Planner',percent_time:50,nims_training:'QA NIMS',exercise_participation:'QA exercise'}],cf_empg_nims:'QA NIMS training',cf_empg_exercises:'QA exercise participation'},
});
test('NOFO definition and value rules',async t=>{
  await t.test('Default forms are independent and retain seven sections and EMPG personnel fields',()=>{
    const a=defaultForm(nofoInput),b=defaultForm(nofoInput);a.sections[1].fields[0].label='Changed';
    assert.equal(b.sections[1].fields[0].label,'Project Title');assert.equal(b.sections.length,7);
    assert.equal(validateDefinition(b,nofoInput).rules.matchPercent,50);
    assert.ok(formFields(b).find(field=>field.id==='cf_empg_personnel'));
  });
  await t.test('Standard fields cannot be deleted, reassigned, or given another storage key',()=>{
    const form=defaultForm(nofoInput);form.sections[1].fields.shift();assert.throws(()=>validateDefinition(form,nofoInput),{status:400});
    const changed=defaultForm(nofoInput);changed.sections[1].fields[0].key='awarded_amount';assert.throws(()=>validateDefinition(changed,nofoInput),{status:400});
  });
  await t.test('Conditional visibility rejects missing parents and cycles',()=>{
    const form=defaultForm(nofoInput),fields=form.sections[1].fields;
    fields[0].condition={fieldId:'absent',operator:'equals',value:'yes'};assert.throws(()=>validateDefinition(form,nofoInput),{status:400});
    fields[0].condition.fieldId=fields[1].id;fields[1].condition={fieldId:fields[0].id,operator:'equals',value:'yes'};
    assert.throws(()=>validateDefinition(form,nofoInput),{status:400});
  });
  await t.test('Required fields, repeating personnel values, dates and hidden fields are validated',()=>{
    const definition=defaultForm(nofoInput),application=validData(),context={application,organization:{name:'QA Org',type:'County',state:'NE'},values:application.form_values};
    assert.deepEqual(validateFormValues(definition,context),[]);
    application.form_values.cf_empg_personnel[0].percent_time=101;
    assert.ok(validateFormValues(definition,context).some(error=>error.message.includes('at most 100')));
    application.project_title='   ';assert.ok(validateFormValues(definition,context).some(error=>error.fieldId==='std_project_title'));
    definition.sections[1].fields[0].visible=false;assert.ok(!validateFormValues(definition,context).some(error=>error.fieldId==='std_project_title'));
    application.performance_start='2026-02-31';assert.ok(validateFormValues(definition,context).some(error=>error.fieldId==='std_performance_start'));
  });
  await t.test('EMPG match uses total project cost and rejects invalid amounts or mismatched totals',()=>{
    const definition=defaultForm(nofoInput),items=[{line_description:'QA staff',amount_requested:'100.00',amount_match:'100.00'}];
    assert.deepEqual(validateBudget(definition,items,{requested_amount:100,match_amount:100}),[]);
    items[0].amount_match='50.00';assert.ok(validateBudget(definition,items,{requested_amount:100,match_amount:50}).some(error=>error.message.includes('50%')));
    items[0].amount_requested='-1';assert.ok(validateBudget(definition,items,{}).length);
    items[0].amount_requested='0.001';assert.ok(validateBudget(definition,items,{}).length);
  });
  await t.test('Turning off the budget step does not bypass the NOFO cost-share rule',()=>{
    const definition=defaultForm(nofoInput);definition.sections.find(section=>section.kind==='budget').enabled=false;
    assert.ok(validateBudget(definition,[],{requested_amount:100,match_amount:50}).some(error=>error.message.includes('50%')));
    assert.deepEqual(validateBudget(definition,[],{requested_amount:100,match_amount:100}),[]);
  });
  await t.test('Fractional match requirements remain exact at the cent boundary for large awards',()=>{
    const definition=defaultForm(nofoInput);definition.rules.matchPercent=33.33;
    const total=100000000009997n,minimum=total*3333n/10000n;
    const currency=cents=>String(cents/100n)+'.'+String(cents%100n).padStart(2,'0');
    const check=match=>{const federal=total-match,application={requested_amount:currency(federal),match_amount:currency(match)};return validateBudget(definition,[{line_description:'QA exact cents',amount_requested:application.requested_amount,amount_match:application.match_amount}],application);};
    assert.ok(check(minimum).some(error=>error.message.includes('33.33%')));assert.deepEqual(check(minimum+1n),[]);
  });
  await t.test('Unsure triggers EHP review while planning-only Yes does not',()=>{
    const definition=defaultForm(nofoInput),application=validData();application.ehp_screening_answers.q10='yes';
    assert.equal(ehpRequired(definition,{application}),false);application.ehp_screening_answers.q1='unknown';
    assert.equal(ehpRequired(definition,{application}),true);
    definition.sections.find(section=>section.kind==='ehp').enabled=false;assert.equal(ehpRequired(definition,{application}),false);
  });
  await t.test('Reviewer and export field visibility are independent',()=>{
    const definition=defaultForm(nofoInput),application=validData(),context={application,organization:{name:'QA Org',type:'County',state:'NE'},values:application.form_values};
    definition.sections[1].fields[0].reviewerVisible=false;
    definition.sections[2].fields.find(field=>field.id==='cf_empg_nims').exportVisible=false;
    assert.ok(!valuesForAudience(definition,context).some(field=>field.id==='std_project_title'));
    assert.ok(valuesForAudience(definition,context,'export').some(field=>field.id==='std_project_title'));
    assert.ok(!valuesForAudience(definition,context,'export').some(field=>field.id==='cf_empg_nims'));
  });
});
test('NOFO forms against an isolated PostgreSQL schema',async t=>{
  const schema='gmt_qa_forms_'+Date.now();await livePool.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...livePool.options,options:'-c search_path='+schema+',public'});let server;
  try {
    for(const table of ['users','organizations','grantees','audit_logs','grant_programs','nofos','applications','application_budgets','documents','notifications','application_reviews','funding_requests','review_comments'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    await migrateAccountAccess(db);await migrateNofoForms(db);
    const ids=Object.fromEntries(['isc','neAdmin','ilAdmin','neUser','ilUser','neOrg','ilOrg','nofo','legacyNofo','ilNofo'].map(key=>[key,randomUUID()]));
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA NE','County','NE'),($2,'QA IL','County','IL')",[ids.neOrg,ids.ilOrg]);
    for(const [name,role,state,org] of [['isc','isc_admin',null,null],['neAdmin','admin','NE',null],['ilAdmin','admin','IL',null],['neUser','user','NE',ids.neOrg],['ilUser','user','IL',ids.ilOrg]]) {
      await db.query("INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status) VALUES($1,$2,$3,'synthetic-test-only',$4,$5,$6,'active')",[ids[name],name+'@gmt-qa.invalid',name,role,state,org]);
    }
    for(const [name,state] of [['nofo','NE'],['legacyNofo','NE'],['ilNofo','IL']])await db.query("INSERT INTO nofos(id,title,program_code,status,scope_states,required_documents) VALUES($1,$2,'EMPG','Published',$3,'[]')",[ids[name],'QA '+name,JSON.stringify([state])]);
    let v1,application;
    await t.test('State admins can configure their state only; subrecipients cannot configure forms',async()=>{
      await assert.rejects(saveNofoForm(db,ids.ilAdmin,ids.nofo,{definition:defaultForm(nofoInput),expectedVersionId:null,expectedRevision:0}),{status:403});
      await assert.rejects(saveNofoForm(db,ids.neUser,ids.nofo,{definition:defaultForm(nofoInput),expectedVersionId:null,expectedRevision:0}),{status:403});
      await assert.rejects(readNofoForm(db,ids.ilUser,ids.nofo),{status:403});
      v1=await saveNofoForm(db,ids.neAdmin,ids.nofo,{definition:defaultForm(nofoInput),expectedVersionId:null,expectedRevision:0});
      assert.equal(v1.version,1);assert.equal(v1.locked_at,null);
    });
    await t.test('Concurrent edits reject one stale revision instead of overwriting it',async()=>{
      const request={definition:v1.definition,expectedVersionId:v1.id,expectedRevision:v1.revision};
      const results=await Promise.allSettled([saveNofoForm(db,ids.isc,ids.nofo,request),saveNofoForm(db,ids.neAdmin,ids.nofo,request)]);
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
      assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
      v1=await readNofoForm(db,ids.isc,ids.nofo);
    });
    await t.test('Starting an application locks its form and does not require submission fields for draft saves',async()=>{
      application=await saveFormApplication(db,ids.neUser,null,{nofo_id:ids.nofo,organization_id:ids.neOrg,project_title:'Draft only'});
      assert.equal(application.form_version_id,v1.id);assert.equal(application.status,'Draft');
      const version=await readNofoForm(db,ids.isc,ids.nofo);assert.ok(version.locked_at);
    });
    await t.test('Changes after an application starts create a version only new applications use',async()=>{
      const definition=structuredClone(v1.definition);definition.sections[1].fields[0].label='Updated Title';
      const v2=await saveNofoForm(db,ids.neAdmin,ids.nofo,{definition,expectedVersionId:v1.id,expectedRevision:v1.revision});
      assert.equal(v2.version,2);assert.notEqual(v2.id,v1.id);
      const old=await applicationFormContext(db,ids.neUser,application.id,'edit');assert.equal(old.version.id,v1.id);assert.equal(old.version.definition.sections[1].fields[0].label,'Project Title');
      const newer=await saveFormApplication(db,ids.neUser,null,{nofo_id:ids.nofo,organization_id:ids.neOrg});assert.equal(newer.form_version_id,v2.id);
    });
    await t.test('Preexisting applications retain a legacy form when a NOFO is first configured',async()=>{
      const oldId=randomUUID();await db.query("INSERT INTO applications(id,nofo_id,organization_id,status) VALUES($1,$2,$3,'Draft')",[oldId,ids.legacyNofo,ids.neOrg]);
      const changed=defaultForm(nofoInput);changed.sections[1].fields[0].label='New Legacy Title';
      const latest=await saveNofoForm(db,ids.isc,ids.legacyNofo,{definition:changed,expectedVersionId:null,expectedRevision:0});assert.equal(latest.version,2);
      const old=await applicationFormContext(db,ids.neUser,oldId,'edit');assert.equal(old.version.version,1);assert.ok(old.version.locked_at);assert.equal(old.version.definition.sections[1].fields[0].label,'Project Title');
    });
    await t.test('Form pins and NOFO links cannot be swapped by a client',async()=>{
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{form_version_id:randomUUID()}),{status:409});
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{nofo_id:ids.ilNofo}),{status:409});
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{awarded_amount:1000}),{status:403});
    });
    await t.test('Changing organization does not allow taking another organization application',async()=>{
      const foreignId=randomUUID();await db.query("INSERT INTO applications(id,nofo_id,organization_id,status) VALUES($1,$2,$3,'Draft')",[foreignId,ids.ilNofo,ids.ilOrg]);
      await assert.rejects(saveFormApplication(db,ids.neUser,foreignId,{organization_id:ids.neOrg}),{status:403});
      await assert.rejects(applicationFormContext(db,ids.neUser,foreignId),{status:403});
    });
    await t.test('Server submission lists missing fields and leaves the application in draft',async()=>{
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{status:'Submitted'}),error=>error.status===422&&error.details.some(detail=>detail.fieldId==='std_project_narrative'));
      const saved=(await db.query('SELECT status FROM applications WHERE id=$1',[application.id])).rows[0];assert.equal(saved.status,'Draft');
    });
    await t.test('Server submission enforces line totals and EMPG match',async()=>{
      await db.query("INSERT INTO application_budgets(application_id,budget_category,line_description,amount_requested,amount_match) VALUES($1,'Personnel','QA staff',100,50)",[application.id]);
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{...validData(),match_amount:50,status:'Submitted'}),error=>error.status===422&&error.details.some(detail=>detail.message.includes('50%')));
      await db.query('UPDATE application_budgets SET amount_match=100 WHERE application_id=$1',[application.id]);
    });
    await t.test('Unsure requires the EHP screening file; clients cannot approve their own EHP',async()=>{
      const data=validData();data.ehp_screening_answers.q1='unknown';
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{...data,status:'Submitted'}),error=>error.status===422&&error.details.some(detail=>detail.message.includes('EHP Screening Form')));
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{ehp_status:'Approved'}),{status:403});
      await db.query("INSERT INTO documents(name,doc_type,application_id,file_url) VALUES('EHP Screening Form','Other',$1,'/api/files/gmt-qa.pdf')",[application.id]);
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{...data,status:'Submitted'},async()=>false),{status:422});
      const result=await saveFormApplication(db,ids.neUser,application.id,{...data,status:'Submitted'},async()=>true);
      assert.equal(result.ehp_required,true);assert.equal(result.ehp_status,'ScreeningRequired');assert.equal(result.status,'Submitted');
      assert.equal(parseObject(result.ehp_screening_answers).q1,'unknown');
      await assert.rejects(saveFormApplication(db,ids.neUser,application.id,{project_title:'Change after submission'}),{status:409});
    });
    await t.test('Required document changes apply to new versions and leave started applications unchanged',async()=>{
      const nofoId=randomUUID();await db.query("INSERT INTO nofos(id,title,program_code,status,scope_states,required_documents) VALUES($1,'QA document versions','EMPG','Published','[\"NE\"]','[]')",[nofoId]);
      const first=await saveNofoForm(db,ids.isc,nofoId,{definition:defaultForm(nofoInput),expectedVersionId:null,expectedRevision:0});
      const started=await saveFormApplication(db,ids.neUser,null,{nofo_id:nofoId,organization_id:ids.neOrg});
      const definition=structuredClone(first.definition);definition.rules.requiredDocuments=[{name:'QA Contract',mandatory:true}];
      const next=await saveNofoForm(db,ids.isc,nofoId,{definition,expectedVersionId:first.id,expectedRevision:first.revision});
      assert.equal(next.version,2);assert.equal(next.definition.rules.requiredDocuments[0].name,'QA Contract');
      const old=await applicationFormContext(db,ids.neUser,started.id,'edit');assert.deepEqual(old.version.definition.rules.requiredDocuments,[]);
    });
    await t.test('Concurrent submissions receive distinct numbers and notify only their state reviewers',async()=>{
      const drafts=await Promise.all([ids.nofo,ids.legacyNofo].map(nofo_id=>saveFormApplication(db,ids.neUser,null,{nofo_id,organization_id:ids.neOrg,...validData()})));
      for(const draft of drafts)await db.query("INSERT INTO application_budgets(application_id,budget_category,line_description,amount_requested,amount_match) VALUES($1,'Personnel','QA staff',100,100)",[draft.id]);
      const results=await Promise.all(drafts.map(draft=>saveFormApplication(db,ids.neUser,draft.id,{status:'Submitted'})));
      assert.notEqual(results[0].application_number,results[1].application_number);assert.match(results[0].application_number,/^APP-[0-9]{4}-[0-9]{5,}$/);
      const notifications=(await db.query('SELECT user_email FROM notifications')).rows;assert.ok(notifications.some(row=>row.user_email==='neAdmin@gmt-qa.invalid'));assert.ok(!notifications.some(row=>row.user_email==='ilAdmin@gmt-qa.invalid'));
    });
    await t.test('HTTP endpoints enforce form permissions and block generic NOFO pointer updates',async()=>{
      const authenticate=createAuthentication(db),app=express();app.use(express.json());
      app.use('/api/forms',createNofoFormsRouter(db,authenticate));app.use('/api/functions',createAuditPackageRouter(db,authenticate));app.use('/api/entities',createFormApplicationRouter(db,authenticate));
      app.use('/api/entities/:entity/:id?',authenticate,createApplicationBudgetAccess(db),createNofoFormEntityAccess(db),(req,res)=>res.json({allowed:true}));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
      const base='http://127.0.0.1:'+server.address().port,actor=(await db.query('SELECT * FROM users WHERE id=$1',[ids.isc])).rows[0],token=generateToken(actor);
      const res=await fetch(base+'/api/entities/Nofo/'+ids.nofo,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({current_form_version_id:randomUUID()})});assert.equal(res.status,400);
      const current=await readNofoForm(db,ids.isc,ids.nofo);
      const save=await fetch(base+'/api/forms/nofos/'+ids.nofo,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({definition:current.definition,expectedVersionId:current.id,expectedRevision:current.revision})});assert.equal(save.status,200);
      const user=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neUser])).rows[0],userToken=generateToken(user);
      const editable=await saveFormApplication(db,ids.neUser,null,{nofo_id:ids.nofo,organization_id:ids.neOrg});
      const invalidBudget=await fetch(base+'/api/entities/ApplicationBudget',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+userToken},body:JSON.stringify({application_id:editable.id,amount_requested:'0.001',amount_match:0})});assert.equal(invalidBudget.status,400);
      const crossBudget=await fetch(base+'/api/entities/ApplicationBudget',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+userToken},body:JSON.stringify({application_id:(await db.query('SELECT id FROM applications WHERE organization_id=$1 LIMIT 1',[ids.ilOrg])).rows[0].id,amount_requested:1})});assert.equal(crossBudget.status,403);
      const changeProgram=await fetch(base+'/api/entities/Nofo/'+ids.nofo,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({program_code:'SHSP'})});assert.equal(changeProgram.status,409);
      const anonymousExport=await fetch(base+'/api/functions/exportAuditPackage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({application_id:application.id})});assert.equal(anonymousExport.status,401);
      const outsideActor=(await db.query('SELECT * FROM users WHERE id=$1',[ids.ilUser])).rows[0];const outsideExport=await fetch(base+'/api/functions/exportAuditPackage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+generateToken(outsideActor)},body:JSON.stringify({application_id:application.id})});assert.equal(outsideExport.status,403);
      const audit=await fetch(base+'/api/functions/exportAuditPackage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({application_id:application.id})});assert.equal(audit.status,200);
      const zip=await JSZip.loadAsync(Buffer.from(await audit.arrayBuffer()));const file=Object.keys(zip.files).find(name=>name.endsWith('/nofo_form_values.json'));assert.ok(file);assert.ok(JSON.parse(await zip.file(file).async('string')).fields.some(field=>field.id==='cf_empg_personnel'));
      const unauthorized=await fetch(base+'/api/forms/nofos/'+ids.nofo);assert.equal(unauthorized.status,401);
      const good=await fetch(base+'/api/forms/applications/'+application.id+'?audience=export',{headers:{Authorization:'Bearer '+token}});assert.equal(good.status,200);assert.ok((await good.json()).fields.some(field=>field.id==='cf_empg_personnel'));
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.end();await livePool.query('DROP SCHEMA '+schema+' CASCADE');await livePool.end();
  }
});
