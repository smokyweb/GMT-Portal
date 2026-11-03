import {createFormApplicationRouter} from '../routes/nofoForms.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import live from '../db/connection.js';
import {migrateAccountAccess} from '../services/accountMigration.js';
import {migrateNofoForms} from '../services/forms/formMigration.js';
import {migrateAwards} from '../services/awards/awardMigration.js';
import {readAwardDetails,saveAwardDetails} from '../services/awards/awardDetails.js';
import {mutateAwardNofo} from '../services/awards/nofoRecords.js';
import {syncApplicationAward} from '../services/awards/awardApplicationSync.js';
import {ensureAwardSnapshot} from '../services/awards/awardRepository.js';
import {transaction} from '../services/accountRepository.js';
import {createAwardDetailsRouter,createAwardNofoEntityRouter} from '../routes/awardDetails.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
test('Award Details and federal NOFO metadata preserve source records and scope',async t=>{
  const schema='gmt_qa_awards_'+Date.now();await live.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  const ids=Object.fromEntries(['org','otherOrg','admin','isc','otherAdmin','user','reviewer','program','otherProgram','nofo','legacy','app','duplicate'].map(key=>[key,randomUUID()]));
  const actor={id:ids.admin,email:'admin@award-qa.invalid',full_name:'QA Award Admin'};
  const metadata=async()=> (await db.query('SELECT * FROM nofos WHERE id=$1',[ids.nofo])).rows[0];
  const read=()=>readAwardDetails(db,ids.admin,ids.app);
  const save=async(fields,resetFields=[])=>saveAwardDetails(db,ids.admin,ids.app,{fields,resetFields,expectedRevision:(await read()).award.revision});
  try {
    for(const table of ['users','organizations','grantees','audit_logs','applications','grant_programs','nofos','application_budgets','notifications','documents'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    await migrateAccountAccess(db);await migrateNofoForms(db);
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA Award NE Org','County','NE'),($2,'QA Award IL Org','County','IL')",[ids.org,ids.otherOrg]);
    for(const [key,role,state,org] of [['admin','admin','NE',null],['isc','isc_admin','',null],['otherAdmin','admin','IL',null],['user','user','NE',ids.org],['reviewer','reviewer','NE',null]])
      await db.query("INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status) VALUES($1,$2,$2,'synthetic-not-a-login-hash',$3,$4,$5,'active')",[ids[key],key+'@award-qa.invalid',role,state,org]);
    await db.query("INSERT INTO grant_programs(id,name,code,cfda_number,program_year) VALUES($1,'QA EMPG','EMPG','97.042',2026),($2,'QA SHSP','SHSP','97.067',2026)",[ids.program,ids.otherProgram]);
    await db.query("INSERT INTO nofos(id,title,program_id,program_code,grant_number,status,scope_states) VALUES($1,'QA Award NOFO',$2,'EMPG','EMK-2026-EP-05006','Published','[\"NE\"]')",[ids.nofo,ids.program]);
    for(const [key,status] of [['legacy','Approved'],['app','Submitted'],['duplicate','Submitted']])
      await db.query("INSERT INTO applications(id,organization_id,organization_name,nofo_id,nofo_title,status,project_title,awarded_amount,match_amount,performance_start,performance_end,total_expended) VALUES($1,$2,'QA Award NE Org',$3,'QA Award NOFO',$4,$5,500,500,'2026-10-01','2027-09-30',100)",[ids[key],ids.org,ids.nofo,status,'QA '+key]);
    await db.query("UPDATE applications SET grant_number='EMK-2026-EP-05004' WHERE id=$1",[ids.legacy]);
    await migrateAwards(db);
    await t.test('Migration preserves existing FAIN data, snapshots approved awards once and is idempotent',async()=>{
      const original=(await db.query('SELECT * FROM award_details WHERE application_id=$1',[ids.legacy])).rows[0];
      assert.equal(original.fields.federal_award_number,'EMK-2026-EP-05004');assert.equal(original.fields.cfda_number,'97.042');
      assert.equal((await metadata()).grant_number,'EMK-2026-EP-05006');
      await migrateAwards(db);assert.equal((await db.query('SELECT count(*) FROM award_details')).rows[0].count,'1');
      assert.equal((await db.query('SELECT id FROM award_details WHERE application_id=$1',[ids.legacy])).rows[0].id,original.id);
    });
    await t.test('NOFO dates, identifiers and configured M&A limits are validated before mutation',async()=>{
      const update=input=>mutateAwardNofo(db,ids.admin,ids.nofo,{expectedAwardMetadataRevision:0,...input});
      await assert.rejects(update({grant_number:'not-a-fain'}),{status:400});
      await assert.rejects(update({cfda_number:'bad'}),{status:400});
      await assert.rejects(update({federal_performance_start:'2026-10-01',federal_performance_end:'2026-09-01'}),{status:400});
      await assert.rejects(update({ma_percent:3}),{status:400});
      await db.query('UPDATE grant_programs SET ma_limit_percent=5 WHERE id=$1',[ids.program]);
      await assert.rejects(update({ma_percent:6}),{status:400});
      assert.equal((await metadata()).award_metadata_revision,0);
      const saved=await update({open_date:'',close_date:'',grant_number:'EMK-2026-EP-05007',cfda_number:'97.042',state_grant_number:'NE-EMPG-2026',federal_award_date:'2026-08-01',federal_performance_start:'2026-09-01',federal_performance_end:'2027-09-30',federal_close_date:'2027-12-31',ma_percent:5,statutory_authority:'QA authority',is_r_and_d:false});
      assert.equal(saved.award_metadata_revision,1);assert.equal(Number(saved.ma_percent),5);
      await assert.rejects(update({state_grant_number:'QA stale'}),{status:409});
      assert.equal((await db.query('SELECT fields FROM award_details WHERE application_id=$1',[ids.legacy])).rows[0].fields.federal_award_number,'EMK-2026-EP-05004');
    });
    await t.test('New award snapshots inherit the current NOFO without changing an earlier award',async()=>{
      await transaction(db,async client=>{
        const app=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[ids.app])).rows[0];await ensureAwardSnapshot(client,app,actor);
      });
      const context=await read();assert.equal(context.award.fields.federal_award_number,'EMK-2026-EP-05007');assert.equal(context.award.fields.federal_award_date,'2026-08-01');
      assert.equal(context.award.origins.federal_award_number,'from NOFO');assert.equal(context.award.fields.award_status,'Pending');
      assert.equal(context.award.fields.award_start,'2026-10-01');
    });
    await t.test('Scoped admin edits synchronize amounts, dates and balances without resetting expenditure',async()=>{
      for(const who of ['user','reviewer','otherAdmin'])await assert.rejects(saveAwardDetails(db,ids[who],ids.app,{expectedRevision:0,fields:{subaward_number:'QA attack'}}),{status:403});
      await assert.rejects(readAwardDetails(db,ids.otherAdmin,ids.app),{status:403});
      const context=await save({subaward_number:'NE-EMPG-2026-001',federal_award_number:'EMK-2026-EP-05008',awarded_amount:'600.00',match_amount:'600.00',award_start:'2026-11-01',award_close:'2027-10-31'});
      assert.equal(context.award.fields.federal_award_number,'EMK-2026-EP-05008');assert.equal(context.award.field_overrides.federal_award_number,true);
      assert.equal((await metadata()).grant_number,'EMK-2026-EP-05007');assert.equal(context.application.grant_number,'EMK-2026-EP-05008');
      assert.equal(Number(context.application.awarded_amount),600);assert.equal(Number(context.application.total_expended),100);assert.equal(Number(context.application.remaining_balance),500);
      assert.equal(context.application.performance_start.toISOString().slice(0,10),'2026-11-01');
      const user=await readAwardDetails(db,ids.user,ids.app);assert.equal(user.can_edit,false);assert.equal(user.award.fields.subaward_number,'NE-EMPG-2026-001');
    });
    await t.test('Explicit restore pulls current NOFO values; ordinary NOFO edits preserve snapshots',async()=>{
      const before=await read();await mutateAwardNofo(db,ids.admin,ids.nofo,{expectedAwardMetadataRevision:(await metadata()).award_metadata_revision,grant_number:'EMK-2026-EP-05009'});
      assert.equal((await read()).award.fields.federal_award_number,before.award.fields.federal_award_number);
      const reset=await save({},['federal_award_number']);assert.equal(reset.award.fields.federal_award_number,'EMK-2026-EP-05009');assert.equal(reset.award.field_overrides.federal_award_number,undefined);
      assert.equal(reset.award.origins.federal_award_number,'from NOFO');
      const cleared=await save({federal_award_number:null});assert.equal(cleared.application.grant_number,null);
      const kept=await transaction(db,async client=>{const app=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[ids.app])).rows[0];return syncApplicationAward(client,{...app,grant_number:'EMK-2026-EP-05009'},app,actor);});
      assert.equal(kept.grant_number,null);await save({},['federal_award_number']);
    });
    await t.test('Duplicate subaward IDs, invalid dates and stale concurrent edits roll back',async()=>{
      const current=await read();await assert.rejects(saveAwardDetails(db,ids.admin,ids.app,{expectedRevision:0,fields:{subaward_number:'QA stale'}}),{status:409});
      await assert.rejects(save({award_close:'2026-01-01'}),{status:400});await assert.rejects(save({awarded_amount:'0.001'}),{status:400});
      await assert.rejects(save({awarded_amount:99}),{status:409});await assert.rejects(save({ma_amount:1000}),{status:400});
      await assert.rejects(saveAwardDetails(db,ids.admin,ids.duplicate,{expectedRevision:0,fields:{subaward_number:current.award.fields.subaward_number}}),{status:409});
      assert.equal((await db.query('SELECT id FROM award_details WHERE application_id=$1',[ids.duplicate])).rows.length,0);
      const results=await Promise.allSettled(['QA-A','QA-B'].map(value=>saveAwardDetails(db,ids.admin,ids.app,{expectedRevision:current.award.revision,fields:{isip_bsir_number:value}})));
      assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.status,409);
    });
    await t.test('The approval sync hook preserves override identifiers and existing expenditure in one transaction',async()=>{
      const original=(await db.query('SELECT * FROM applications WHERE id=$1',[ids.app])).rows[0];
      const result=await transaction(db,async client=>{
        const before=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[ids.app])).rows[0];
        const changed=(await client.query("UPDATE applications SET status='Approved',awarded_amount=700,total_expended=0,remaining_balance=700 WHERE id=$1 RETURNING *",[ids.app])).rows[0];
        return syncApplicationAward(client,changed,before,actor);
      });
      assert.equal(Number(result.total_expended),100);assert.equal(Number(result.remaining_balance),600);assert.equal(result.grant_number,'EMK-2026-EP-05009');
      assert.equal(Number((await read()).award.fields.awarded_amount),700);
      assert.equal((await db.query("SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action='AwardDetailsSynchronized'",[ids.app])).rows[0].count,'1');
      await assert.rejects(transaction(db,async client=>{
        const before=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[ids.app])).rows[0];
        const changed=(await client.query('UPDATE applications SET awarded_amount=-1 WHERE id=$1 RETURNING *',[ids.app])).rows[0];return syncApplicationAward(client,changed,before,actor);
      }),{status:400});
      await assert.rejects(transaction(db,async client=>{
        const before=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[ids.app])).rows[0];
        const changed=(await client.query('UPDATE applications SET awarded_amount=900 WHERE id=$1 RETURNING *',[ids.app])).rows[0];await syncApplicationAward(client,changed,before,actor);throw new Error('QA rollback');
      }),/QA rollback/);assert.equal(Number((await read()).award.fields.awarded_amount),700);assert.equal(original.organization_id,result.organization_id);
    });
    await t.test('NOFO permission and form locks remain enforced in the new record writer',async()=>{
      await assert.rejects(mutateAwardNofo(db,ids.otherAdmin,ids.nofo,{status:'Closed'}),{status:403});
      await assert.rejects(mutateAwardNofo(db,ids.user,ids.nofo,{status:'Closed'}),{status:403});
      await assert.rejects(mutateAwardNofo(db,ids.admin,ids.nofo,{program_id:ids.otherProgram,expectedAwardMetadataRevision:(await metadata()).award_metadata_revision}),{status:409});
      await assert.rejects(mutateAwardNofo(db,ids.admin,ids.nofo,{current_form_version_id:randomUUID()}),{status:400});
      await assert.rejects(mutateAwardNofo(db,ids.admin,ids.nofo,{},'DELETE'),{status:409});
      const created=await mutateAwardNofo(db,ids.admin,null,{title:'QA state-created NOFO',program_id:ids.program,scope_states:['IL'],grant_number:'EMK-2026-EP-05010',fiscal_year:2026},'POST');
      assert.deepEqual(created.scope_states,['NE']);assert.equal(created.cfda_number,'97.042');
    });
    await t.test('HTTP APIs authenticate and preserve readonly subrecipient award access',async()=>{
      const app=express();app.use(express.json());const auth=createAuthentication(db);app.use('/api/awards',createAwardDetailsRouter(db,auth));app.use('/api/entities',createAwardNofoEntityRouter(db,auth));app.use('/api/entities',createFormApplicationRouter(db,auth));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,method='GET',body,who)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/api/awards/applications/'+ids.app)).status,401);
      assert.equal((await call('/api/awards/applications/'+ids.app,'GET',null,'user')).status,200);
      assert.equal((await call('/api/awards/applications/'+ids.app,'PUT',{expectedRevision:0,fields:{award_status:'Active'}},'user')).status,403);
      assert.equal((await call('/api/entities/Nofo/'+ids.nofo,'PUT',{status:'Closed'},'otherAdmin')).status,403);
      assert.equal((await call('/api/entities/Nofo/'+ids.nofo,'PUT',{expectedAwardMetadataRevision:(await metadata()).award_metadata_revision,state_grant_number:'NE-QA-final'},'admin')).status,200);
    });
    await t.test('The approved generic Application API wiring synchronizes awards and preserves spending atomically',async()=>{
      const base='http://127.0.0.1:'+server.address().port;
      const update=(body,who='admin')=>fetch(base+'/api/entities/Application/'+ids.app,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+generateToken({id:ids[who]})},body:JSON.stringify(body)});
      for(const who of ['user','reviewer','otherAdmin'])assert.equal((await update({awarded_amount:800},who)).status,403);
      const response=await update({awarded_amount:800,match_amount:800,performance_start:'2026-12-01'});assert.equal(response.status,200);const result=await response.json();
      assert.equal(Number(result.total_expended),100);assert.equal(Number(result.remaining_balance),700);assert.equal(Number(result.expenditure_rate),12.5);assert.equal(result.grant_number,'EMK-2026-EP-05009');
      const award=await read();assert.equal(Number(award.award.fields.awarded_amount),800);assert.equal(award.award.fields.award_start,'2026-12-01');
      assert.equal((await update({awarded_amount:99})).status,409);assert.equal(Number((await read()).award.fields.awarded_amount),800);
      await db.query("CREATE FUNCTION qa_fail_award_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='AwardDetailsSynchronized' THEN RAISE EXCEPTION 'QA award sync failure'; END IF;RETURN NEW;END $$; CREATE TRIGGER qa_fail_award_sync BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION qa_fail_award_sync()");
      try{assert.equal((await update({awarded_amount:900})).status,500);const unchanged=await read();assert.equal(Number(unchanged.award.fields.awarded_amount),800);assert.equal(Number(unchanged.application.awarded_amount),800);assert.equal(Number(unchanged.application.total_expended),100);assert.equal(Number(unchanged.application.remaining_balance),700);}
      finally{await db.query('DROP TRIGGER qa_fail_award_sync ON audit_logs');}
    });
    await t.test('Approval through the actual Application API creates a matching immutable-source award snapshot',async()=>{
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/entities/Application/'+ids.duplicate,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+generateToken({id:ids.admin})},body:JSON.stringify({status:'Approved',awarded_amount:450})});
      assert.equal(response.status,200);const app=await response.json();assert.equal(Number(app.total_expended),100);assert.equal(Number(app.remaining_balance),350);
      const award=await readAwardDetails(db,ids.admin,ids.duplicate);assert.equal(Number(award.award.fields.awarded_amount),450);assert.equal(award.award.fields.federal_award_number,'EMK-2026-EP-05009');assert.equal(award.award.fields.award_status,'Pending');
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
