import express from 'express';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthentication,generateToken} from '../middleware/auth.js';
import {createGanPreviewRouter} from '../routes/ganPreview.js';
import {ganPdfData} from './fixtures/ganPdfData.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import live from '../db/connection.js';
import {previewGanFromRecords} from '../services/documents/ganContext.js';
const body='{{organization_name}} / {{authorized_official_email}} / {{federal_award_number}} / {{total_award_amount}} / {{budget_total}}';
test('GAN previews use one read-only database snapshot and assigned record access',async t=>{
  const schema='gmt_qa_gan_context_'+Date.now();
  assert.match(schema,/^gmt_qa_gan_context_\d+$/);
  await live.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});
  const ids=Object.fromEntries(['admin','otherAdmin','isc','reviewer','user','official','otherOfficial','org','otherOrg','grantee','otherGrantee','program','nofo','app','award','budget','template','form'].map(key=>[key,randomUUID()]));
  let server;
  const options={templateId:ids.template,authorizedOfficialId:ids.official,granteeId:ids.grantee,awardDate:'2026-10-29'};
  const preview=(who='admin',changes={})=>previewGanFromRecords(db,ids[who],ids.app,{...options,...changes});
  try {
    for(const table of ['users','organizations','grantees','grant_programs','nofos','applications','application_budgets','document_templates'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    await db.query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_version_id UUID');
    await db.query('ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS poete TEXT');
    await db.query('CREATE TABLE award_details(id UUID PRIMARY KEY,application_id UUID UNIQUE,fields JSONB,revision INTEGER)');
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA GAN Nebraska','County','NE'),($2,'QA GAN Illinois','County','IL')",[ids.org,ids.otherOrg]);
    await db.query("INSERT INTO grantees(id,name,state_code) VALUES($1,'QA NE Grantee','NE'),($2,'QA IL Grantee','IL')",[ids.grantee,ids.otherGrantee]);
    for(const [key,role,state,org] of [['admin','admin','NE',null],['otherAdmin','admin','IL',null],['isc','isc_admin',null,null],['reviewer','reviewer','NE',null],['user','user','NE',ids.org],['official','user','NE',ids.org],['otherOfficial','user','IL',ids.otherOrg]])
      await db.query("INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status) VALUES($1,$2,$3,'NEVER-RETURN-THIS-HASH',$4,$5,$6,'active')",[ids[key],key+'@gan-context-qa.invalid','QA '+key,role,state,org]);
    await db.query("INSERT INTO grant_programs(id,name,code) VALUES($1,'QA GAN EMPG','EMPG')",[ids.program]);
    await db.query("INSERT INTO nofos(id,title,program_id,program_code,status,scope_states) VALUES($1,'QA GAN NOFO',$2,'EMPG','Published','[\"NE\"]')",[ids.nofo,ids.program]);
    await db.query("INSERT INTO applications(id,nofo_id,organization_id,status,application_number,project_title,awarded_amount,match_amount,requested_amount,program_code) VALUES($1,$2,$3,'Approved','APP-QA-001','QA radios',500,0,500,'EMPG')",[ids.app,ids.nofo,ids.org]);
    await db.query("INSERT INTO award_details VALUES($1,$2,$3,7)",[ids.award,ids.app,JSON.stringify({federal_award_number:'EMK-2026-EP-05006',award_status:'Pending',awarded_amount:500,match_amount:0})]);
    await db.query("INSERT INTO application_budgets(id,application_id,budget_category,poete,amount_requested,amount_match) VALUES($1,$2,'Equipment','Equipment',500,0)",[ids.budget,ids.app]);
    await db.query("INSERT INTO document_templates(id,name,doc_type,template_body,is_active,program_codes,version) VALUES($1,'QA GAN Template','Grant Award Notice',$2,true,'EMPG',2)",[ids.template,body]);
    await t.test('Saved award amounts and official identity resolve without exposing credentials or mutating records',async()=>{
      const before=(await db.query('SELECT * FROM award_details')).rows;
      const result=await preview();
      assert.equal(result.ready,true);assert.equal(result.previewOnly,true);assert.equal(result.values.total_award_amount,'$500.00');
      assert.ok(result.body.includes('official@gan-context-qa.invalid'));assert.equal(result.sources.awardRevision,7);assert.equal(result.template.version,2);
      assert.equal(result.template.body_sha256.length,64);assert.ok(!JSON.stringify(result).includes('NEVER-RETURN-THIS-HASH'));
      assert.deepEqual((await db.query('SELECT * FROM award_details')).rows,before);
    });
    await t.test('Subrecipient, reviewer, another state and inactive administrators cannot prepare this award',async()=>{
      for(const who of ['user','reviewer','otherAdmin'])await assert.rejects(preview(who),{status:403});
      assert.equal((await preview('isc')).ready,true);
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.admin]);
      await assert.rejects(preview(),{status:401});await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.admin]);
    });
    await t.test('Caller-provided record values, identity substitutions and malformed selectors are rejected',async()=>{
      for(const changes of [{award:{fields:{awarded_amount:1}}},{organization:{name:'Forged'}},{actor:{role:'isc_admin'}},{programCodes:[]},{templateId:'bad'},{authorizedOfficialId:[ids.official]},{awardDate:'2026-02-31'},{dueDate:'not-a-date'}])await assert.rejects(preview('admin',changes),{status:400});
    });
    await t.test('Official and grantee choices require registered active records in the recipient state and organization',async()=>{
      await assert.rejects(preview('admin',{authorizedOfficialId:ids.otherOfficial}),{status:403});
      await assert.rejects(preview('admin',{granteeId:ids.otherGrantee}),{status:403});
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.official]);await assert.rejects(preview(),{status:403});
      await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.official]);
      await db.query('UPDATE grantees SET is_active=false WHERE id=$1',[ids.grantee]);await assert.rejects(preview(),{status:403});
      await db.query('UPDATE grantees SET is_active=true WHERE id=$1',[ids.grantee]);
    });
    await t.test('Missing selections and missing award records return correction instructions without creating records',async()=>{
      const missing=await preview('admin',{authorizedOfficialId:null,granteeId:null,templateId:null});
      assert.equal(missing.ready,false);assert.ok(missing.issues.some(issue=>issue.source.field==='authorized_official_id'));
      const saved=(await db.query('DELETE FROM award_details RETURNING *')).rows[0];
      const result=await preview();assert.equal(result.ready,false);assert.equal(result.sources.awardId,null);
      assert.equal((await db.query('SELECT count(*) FROM award_details')).rows[0].count,'0');
      await db.query('INSERT INTO award_details VALUES($1,$2,$3,$4)',[saved.id,saved.application_id,JSON.stringify(saved.fields),saved.revision]);
    });
    await t.test('A missing pinned form and ambiguous legacy program cannot fall through to current defaults',async()=>{
      await db.query('UPDATE applications SET form_version_id=$2 WHERE id=$1',[ids.app,ids.form]);
      const missing=await preview();assert.ok(missing.issues.some(issue=>issue.source.field==='form_version_id'));
      await db.query('UPDATE applications SET form_version_id=NULL WHERE id=$1',[ids.app]);
      await db.query('UPDATE nofos SET program_id=NULL WHERE id=$1',[ids.nofo]);
      const duplicate=randomUUID();await db.query("INSERT INTO grant_programs(id,name,code) VALUES($1,'QA duplicate','EMPG')",[duplicate]);
      const ambiguous=await preview();assert.equal(ambiguous.ready,false);assert.ok(ambiguous.issues.some(issue=>issue.reason.includes('ambiguous')));
      await db.query('DELETE FROM grant_programs WHERE id=$1',[duplicate]);await db.query('UPDATE nofos SET program_id=$2 WHERE id=$1',[ids.nofo,ids.program]);
    });
    await t.test('Templates must be active GANs for the saved award program',async()=>{
      await db.query("UPDATE document_templates SET program_codes='[\"NSGP\"]' WHERE id=$1",[ids.template]);
      assert.equal((await preview()).ready,false);
      await db.query("UPDATE document_templates SET program_codes='EMPG',is_active=false WHERE id=$1",[ids.template]);await assert.rejects(preview(),{status:409});
      await db.query('UPDATE document_templates SET is_active=true WHERE id=$1',[ids.template]);
    });
    await t.test('Empty templates and inactive grant programs stay blocked',async()=>{
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,'   ']);assert.equal((await preview()).ready,false);
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,body]);
      await db.query('UPDATE grant_programs SET is_active=false WHERE id=$1',[ids.program]);assert.equal((await preview()).ready,false);
      await db.query('UPDATE grant_programs SET is_active=true WHERE id=$1',[ids.program]);
    });
    await t.test('The loader keeps a consistent snapshot when source records change during preview',async()=>{
      let changed=false,readOnly=false;
      const instrumented={connect:async()=>{
        const client=await db.connect();
        return {release:()=>client.release(),query:async(sql,args)=>{
          if(sql.startsWith('SELECT * FROM application_budgets')&&!changed) {
            readOnly=(await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only==='on';
            changed=true;await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,'Changed concurrently {{organization_name}}']);
          }
          return client.query(sql,args);
        }};
      }};
      const result=await previewGanFromRecords(instrumented,ids.admin,ids.app,options);
      assert.equal(readOnly,true);assert.equal(result.ready,true);assert.ok(!result.body.includes('Changed concurrently'));
      assert.ok((await preview()).body.includes('Changed concurrently'));
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,body]);
    });
    await t.test('Authenticated HTTP preview prepares JSON and PDF from current saved records without issuing an award',async()=>{
      const fixture=ganPdfData(),canonical=fs.readFileSync(new URL('../templates/gan/GAN_EMPG_portal_body.md',import.meta.url),'utf8');
      assert.match(schema,/^gmt_qa_gan_context_\d+$/);
      // Only this disposable schema gets fields for the upcoming official/grantee configuration flow.
      const saveFixture=async(table,id,values)=>{
        const columns=new Set((await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',[schema,table])).rows.map(row=>row.column_name));
        const entries=Object.entries(values).filter(([key])=>key!=='id'&&key!=='organization_id');
        for(const [key,value] of entries)if(!columns.has(key))await db.query('ALTER TABLE '+table+' ADD COLUMN '+key+' '+(typeof value==='boolean'?'BOOLEAN':typeof value==='number'?'NUMERIC':'TEXT'));
        await db.query('UPDATE '+table+' SET '+entries.map(([key],i)=>key+'=$'+(i+2)).join(',')+' WHERE id=$1',[id,...entries.map(([,value])=>value)]);
      };
      await saveFixture('nofos',ids.nofo,fixture.nofo);await saveFixture('grant_programs',ids.program,fixture.program);
      await saveFixture('organizations',ids.org,fixture.organization);await saveFixture('grantees',ids.grantee,fixture.grantee);
      await saveFixture('users',ids.official,fixture.authorizedOfficial);await saveFixture('applications',ids.app,fixture.application);
      await db.query('UPDATE award_details SET fields=$2 WHERE id=$1',[ids.award,JSON.stringify(fixture.award.fields)]);
      await db.query('UPDATE application_budgets SET amount_match=500 WHERE id=$1',[ids.budget]);
      await db.query('UPDATE document_templates SET template_body=$2 WHERE id=$1',[ids.template,canonical]);
      const app=express();app.use(express.json());app.use('/api/gan',createGanPreviewRouter(db,createAuthentication(db)));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const request=(path,who,payload=options)=>fetch(base+'/api/gan/applications/'+ids.app+path,{method:'POST',headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{})},body:JSON.stringify(payload)});
      assert.equal((await request('/preview',null)).status,401);
      for(const who of ['user','reviewer','otherAdmin'])assert.equal((await request('/preview.pdf',who)).status,403);
      assert.equal((await request('/preview','admin',{...options,award:{awarded_amount:1}})).status,400);
      const jsonResponse=await request('/preview','admin'),json=await jsonResponse.json();assert.equal(jsonResponse.status,200);assert.equal(json.ready,true);assert.equal(json.readyForSending,false);assert.equal(json.template.body,undefined);
      const response=await request('/preview.pdf','admin'),pdf=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');
      assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-gmt-document-preview'),'true');assert.equal(response.headers.get('x-gmt-document-sha256'),createHash('sha256').update(pdf).digest('hex'));assert.ok(pdf.subarray(0,5).toString()==='%PDF-');
      assert.equal((await db.query('SELECT revision FROM award_details WHERE id=$1',[ids.award])).rows[0].revision,7);
      const missingResponse=await request('/preview.pdf','admin',{...options,authorizedOfficialId:null});assert.equal(missingResponse.status,422);assert.ok((await missingResponse.json()).details.some(issue=>issue.token==='authorized_official_email'));
    });
    await t.test('Inactive organizations block readiness even for an ISC administrator',async()=>{
      await db.query('UPDATE organizations SET is_active=false WHERE id=$1',[ids.org]);
      const result=await preview('isc');assert.equal(result.ready,false);assert.ok(result.issues.some(issue=>issue.source.field==='is_active'));
    });
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
