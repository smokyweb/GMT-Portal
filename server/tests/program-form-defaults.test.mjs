import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import pg from 'pg';
import pool from '../db/connection.js';
import {defaultForm,formFields} from '../../src/lib/forms/defaultForm.js';
import {migrateAccountAccess} from '../services/accountMigration.js';
import {migrateNofoForms} from '../services/forms/formMigration.js';
import {readNofoForm,saveNofoForm} from '../services/forms/formVersions.js';
import {readProgramForm} from '../services/forms/programFormDefaults.js';
import {saveProgramForm} from '../services/forms/programFormVersions.js';
import {saveFormApplication,applicationFormContext} from '../services/forms/applicationFormSave.js';
import {createNofoFormsRouter} from '../routes/nofoForms.js';
import {createProgramFormEntityAccess} from '../middleware/programFormEntityAccess.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
const update=(model,changes={})=>({definition:structuredClone(model.definition),scope_state:model.scope_state,
  expectedVersionId:model.id,expectedRevision:model.revision,expectedInheritedVersionId:model.inherited_from_version_id,...changes});
const title=(definition,label)=>{definition.sections.find(section=>section.kind==='program').fields.find(field=>field.key==='empg_work_plan_objectives').label=label;return definition;};
test('Grant program application defaults are scoped and immutable once used',async t=>{
  const schema='gmt_qa_program_forms_'+Date.now();await pool.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...pool.options,options:'-c search_path='+schema+',public'});let server;
  try {
    for(const table of ['users','organizations','grantees','audit_logs','grant_programs','nofos','applications','application_budgets','documents','notifications'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    await migrateAccountAccess(db);await migrateNofoForms(db);
    const ids=Object.fromEntries(['isc','neAdmin','ilAdmin','neUser','ilUser','neOrg','ilOrg','program','neNofo','ilNofo','multiNofo','freshIl','staleNofo','raceNofo'].map(key=>[key,randomUUID()]));
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA Nebraska','County','NE'),($2,'QA Illinois','County','IL')",[ids.neOrg,ids.ilOrg]);
    for(const [name,role,state,org] of [['isc','isc_admin',null,null],['neAdmin','admin','NE',null],['ilAdmin','admin','IL',null],['neUser','user','NE',ids.neOrg],['ilUser','user','IL',ids.ilOrg]])await db.query("INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status) VALUES($1,$2,$3,'synthetic-test-only',$4,$5,$6,'active')",[ids[name],name+'@gmt-qa.invalid',name,role,state,org]);
    await db.query("INSERT INTO grant_programs(id,name,code,is_active) VALUES($1,'QA EMPG','EMPG',true)",[ids.program]);
    for(const [name,states] of [['neNofo',['NE']],['ilNofo',['IL']],['multiNofo',['NE','IL']],['freshIl',['IL']],['staleNofo',['IL']],['raceNofo',['IL']]])await db.query("INSERT INTO nofos(id,title,program_id,program_code,status,scope_states,required_documents) VALUES($1,$2,$3,'EMPG','Published',$4,'[]')",[ids[name],'QA '+name,ids.program,JSON.stringify(states)]);
    let global,ne,legacyId,started,staleIl;
    await t.test('Global defaults can be configured through data instead of hard-coded screens',async()=>{
      const initial=await readProgramForm(db,ids.isc,ids.program);
      assert.equal(initial.version,0);assert.equal(initial.scope_state,'');assert.equal(initial.definition.rules.matchPercent,50);
      const request=update(initial);title(request.definition,'Global Work Plan');
      request.definition.sections.find(section=>section.kind==='program').fields.push({id:'cf_program_field',key:'cf_program_field',label:'Program-specific Custom Detail',source:'custom',type:'text',required:false,visible:true,reviewerVisible:true,exportVisible:true});
      global=await saveProgramForm(db,ids.isc,ids.program,request);assert.equal(global.version,1);
      const nofo=await readNofoForm(db,ids.neUser,ids.neNofo);assert.equal(nofo.program_default_version_id,global.id);assert.ok(formFields(nofo.definition).some(field=>field.id==='cf_program_field'));assert.equal(nofo.can_edit,false);
    });
    await t.test('State defaults override global defaults only for that state',async()=>{
      const model=await readProgramForm(db,ids.neAdmin,ids.program);assert.equal(model.scope_state,'NE');assert.equal(model.id,null);assert.equal(model.inherited_from_version_id,global.id);
      const request=update(model);title(request.definition,'Nebraska Work Plan');
      ne=await saveProgramForm(db,ids.neAdmin,ids.program,request);
      const neForm=await readNofoForm(db,ids.neUser,ids.neNofo),ilForm=await readNofoForm(db,ids.ilUser,ids.ilNofo),multi=await readNofoForm(db,ids.neUser,ids.multiNofo);
      assert.equal(neForm.program_default_version_id,ne.id);assert.equal(ilForm.program_default_version_id,global.id);assert.equal(multi.program_default_version_id,global.id);
      assert.equal(formFields(neForm.definition).find(field=>field.key==='empg_work_plan_objectives').label,'Nebraska Work Plan');
      started=await saveFormApplication(db,ids.neUser,null,{nofo_id:ids.neNofo,organization_id:ids.neOrg});
      staleIl=await readProgramForm(db,ids.ilAdmin,ids.program);
    });
    await t.test('State administrators cannot modify another state or global defaults',async()=>{
      await assert.rejects(readProgramForm(db,ids.neAdmin,ids.program,'IL'),{status:403});
      await assert.rejects(saveProgramForm(db,ids.neAdmin,ids.program,{...update(ne),scope_state:''}),{status:403});
      await assert.rejects(saveProgramForm(db,ids.neUser,ids.program,update(ne)),{status:403});
    });
    await t.test('Updating defaults preserves started and unversioned legacy applications',async()=>{
      legacyId=randomUUID();await db.query("INSERT INTO applications(id,nofo_id,organization_id,status) VALUES($1,$2,$3,'Draft')",[legacyId,ids.ilNofo,ids.ilOrg]);
      const request=update(global);title(request.definition,'Global Work Plan v2');global=await saveProgramForm(db,ids.isc,ids.program,request);
      const old=await applicationFormContext(db,ids.ilUser,legacyId,'edit'),neStarted=await applicationFormContext(db,ids.neUser,started.id,'edit'),fresh=await readNofoForm(db,ids.ilUser,ids.freshIl);
      assert.equal(formFields(old.version.definition).find(field=>field.key==='empg_work_plan_objectives').label,'Global Work Plan');
      assert.equal(formFields(neStarted.version.definition).find(field=>field.key==='empg_work_plan_objectives').label,'Nebraska Work Plan');
      assert.equal(fresh.program_default_version_id,global.id);assert.equal(old.version.program_default_version_id,staleIl.inherited_from_version_id);
    });
    await t.test('A stale inherited global default cannot silently become a state override',async()=>{
      await assert.rejects(saveProgramForm(db,ids.ilAdmin,ids.program,update(staleIl)),{status:409});
    });
    await t.test('Concurrent same-scope saves reject the stale editor',async()=>{
      const model=await readProgramForm(db,ids.neAdmin,ids.program);
      const results=await Promise.allSettled([saveProgramForm(db,ids.neAdmin,ids.program,update(model)),saveProgramForm(db,ids.neAdmin,ids.program,update(model))]);
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
    });
    await t.test('NOFO overrides retain their own rules and detect a changed inherited version',async()=>{
      await db.query("UPDATE nofos SET match_requirement=40,required_documents='[{\"name\":\"Local Document\",\"mandatory\":true}]' WHERE id=$1",[ids.staleNofo]);
      const previous=await readNofoForm(db,ids.ilUser,ids.staleNofo);assert.equal(previous.definition.rules.matchPercent,40);assert.ok(previous.definition.rules.requiredDocuments.some(doc=>doc.name==='Local Document'));
      global=await saveProgramForm(db,ids.isc,ids.program,update(global));
      await assert.rejects(saveNofoForm(db,ids.isc,ids.staleNofo,{definition:previous.definition,expectedVersionId:null,expectedRevision:0,expectedProgramDefaultId:previous.program_default_version_id}),{status:409});
    });
    await t.test('Concurrent application start and defaults save pin one complete immutable version',async()=>{
      const before=global.id;
      const [app,next]=await Promise.all([saveFormApplication(db,ids.ilUser,null,{nofo_id:ids.raceNofo,organization_id:ids.ilOrg}),saveProgramForm(db,ids.isc,ids.program,update(global))]);
      const context=await applicationFormContext(db,ids.ilUser,app.id,'edit');assert.ok([before,next.id].includes(context.version.program_default_version_id));
      global=next;
    });
    await t.test('Program endpoints require an admin and generic mutations cannot invalidate used codes',async()=>{
      const auth=createAuthentication(db),app=express();app.use(express.json());app.use('/api/forms',createNofoFormsRouter(db,auth));
      app.use('/api/entities/:entity/:id?',auth,createProgramFormEntityAccess(db),(req,res)=>res.json({allowed:true}));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const admin=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neAdmin])).rows[0],user=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neUser])).rows[0];
      const request=(path,method,body,actor)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+generateToken(actor)}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await request('/api/forms/programs/'+ids.program,'GET',null,user)).status,403);
      assert.equal((await request('/api/forms/programs/'+ids.program,'GET',null,null)).status,401);
      assert.equal((await request('/api/forms/programs/'+ids.program+'?scope_state=IL','GET',null,admin)).status,403);
      assert.equal((await request('/api/entities/GrantProgram/'+ids.program,'PUT',{code:'OTHER'},admin)).status,409);
      assert.equal((await request('/api/entities/GrantProgram/'+ids.program,'DELETE',null,admin)).status,409);
      const good=await request('/api/forms/programs/'+ids.program,'GET',null,admin);assert.equal(good.status,200);assert.equal((await good.json()).scope_state,'NE');
    });
  }finally {if(server)await new Promise(resolve=>server.close(resolve));await db.end();await pool.query('DROP SCHEMA '+schema+' CASCADE');await pool.end();}
});
