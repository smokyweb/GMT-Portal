import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import express from 'express';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {migrateGanSettings} from '../services/documents/ganSettingsMigration.js';
import {migrateGanBatches} from '../services/documents/ganBatchMigration.js';
import {readGanOrganizationSettings,saveGanOrganizationSettings} from '../services/documents/ganOrganizationSettings.js';
import {readGanGranteeSettings,saveGanGranteeSettings} from '../services/documents/ganGranteeSettings.js';
import {previewGanFromRecords} from '../services/documents/ganContext.js';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {readGanDraft} from '../services/documents/ganDraftRead.js';
import {createGanBatch} from '../services/documents/ganBatchPlan.js';
import {runGanBatch} from '../services/documents/ganBatchRun.js';
import {createGanSettingsRouter} from '../routes/ganSettings.js';
import {createGanSettingsEntityAccess} from '../middleware/ganSettingsEntityAccess.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
import {createAuthRouter} from '../routes/auth.js';
test('Saved GAN contacts and grantee sources preserve scope, revisions and immutable documents',async t=>{
  const schema='gmt_qa_gan_settings_'+Date.now();assert.match(schema,/^gmt_qa_gan_settings_\d+$/);
  await live.query('CREATE SCHEMA '+schema);const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
  try {
    const {ids}=await seedGanDraftDatabase(db,schema);await migrateGanSettings(db);await migrateGanBatches(db);
    const orgRead=(who='admin')=>readGanOrganizationSettings(db,ids[who],ids.org);
    const granteeRead=()=>readGanGranteeSettings(db,ids.admin,ids.grantee);
    const orgSave=async(changes,who='admin')=>saveGanOrganizationSettings(db,ids[who],ids.org,{expectedRevision:(await orgRead()).revision,...changes},'127.0.0.1');
    const granteeSave=async changes=>saveGanGranteeSettings(db,ids.admin,ids.grantee,{expectedRevision:(await granteeRead()).revision,...changes},'127.0.0.1');
    await t.test('Migration adds empty assignments without replacing legacy grantee contact text and can run twice',async()=>{
      const org=await orgRead(),grantee=await granteeRead();assert.equal(org.settings.authorized_official_id,null);assert.equal(org.settings.grantee_id,null);
      assert.equal(grantee.settings.approving_official_name,'QA Assistant Director');assert.equal(grantee.revision,0);
      await migrateGanSettings(db);assert.equal((await orgRead()).revision,0);assert.equal((await granteeRead()).settings.approving_official_name,grantee.settings.approving_official_name);
    });
    await t.test('Only assigned administrators can save an organization official/grantee; members see a readonly record',async()=>{
      for(const who of ['user','otherUser','otherAdmin','reviewer'])await assert.rejects(orgSave({authorized_official_id:ids.official},who),{status:403});
      const member=await orgRead('user');assert.equal(member.can_edit,false);
      await assert.rejects(readGanOrganizationSettings(db,ids.user,ids.otherOrg),{status:403});
      const saved=await orgSave({authorized_official_id:ids.official,grantee_id:ids.grantee});assert.equal(saved.revision,1);assert.equal(saved.official.id,ids.official);
      assert.ok(!JSON.stringify(saved).includes('password_hash'));assert.equal((await orgRead('user')).official.id,ids.official);
      await assert.rejects(orgSave({authorized_official_id:ids.otherUser}),{status:403});await assert.rejects(orgSave({authorized_official_id:ids.admin}),{status:403});
      await assert.rejects(orgSave({grantee_id:ids.otherGrantee}),{status:403});
    });
    await t.test('Stale or concurrent assignments cannot overwrite another administrator change',async()=>{
      await assert.rejects(saveGanOrganizationSettings(db,ids.admin,ids.org,{expectedRevision:0,authorized_official_id:ids.user}),{status:409});
      const revision=(await orgRead()).revision;
      const alternative=randomUUID();await db.query("INSERT INTO users(id,email,full_name,password_hash,role,organization_id,active_status) VALUES($1,'alternate@gan-settings-qa.invalid','QA Alternate','synthetic','user',$2,'active')",[alternative,ids.org]);
      const results=await Promise.allSettled([ids.user,alternative].map(id=>saveGanOrganizationSettings(db,ids.admin,ids.org,{expectedRevision:revision,authorized_official_id:id})));
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
      await orgSave({authorized_official_id:ids.official});
    });
    await t.test('Grantee settings select a registered same-agency approver without trusting an injected name',async()=>{
      for(const who of ['user','reviewer','otherAdmin'])await assert.rejects(readGanGranteeSettings(db,ids[who],ids.grantee),{status:403});
      await assert.rejects(granteeSave({approving_official_id:ids.otherAdmin}),{status:403});
      await assert.rejects(granteeSave({contact_email:'not-an-email'}),{status:400});
      await assert.rejects(granteeSave({role:'isc_admin'}),{status:400});
      const saved=await granteeSave({approving_official_id:ids.admin,approving_official_name:'Injected identity',approving_official_title:'Assistant Director',contact_title:'Grant Coordinator'});
      assert.equal(saved.settings.approving_official_name,'QA admin');assert.equal(saved.official.id,ids.admin);
      assert.ok(!JSON.stringify(saved).includes('synthetic-not-a-login-hash'));
    });
    await t.test('Single GAN generation resolves saved assignments and stores the actual selected identities',async()=>{
      const options={templateId:ids.template,awardDate:'2026-10-29'},preview=await previewGanFromRecords(db,ids.admin,ids.app,options);assert.equal(preview.ready,true);
      assert.equal(preview.sources.authorizedOfficialId,ids.official);assert.equal(preview.sources.granteeId,ids.grantee);assert.equal(preview.sources.approvingOfficialId,ids.admin);
      assert.equal(preview.values.approving_official_name,'QA admin');assert.equal(preview.values.approving_official_title,'Assistant Director');
      const saved=await saveGanDraft(db,ids.admin,ids.app,{...options,requestId:randomUUID(),expectedRevision:0});
      const stored=await readGanDraft(db,ids.admin,saved.document.id);assert.equal(stored.snapshot.sources.authorizedOfficialId,ids.official);
      await orgSave({authorized_official_id:ids.user});
      assert.deepEqual((await readGanDraft(db,ids.admin,saved.document.id)).pdf,stored.pdf);
      await orgSave({authorized_official_id:ids.official});
    });
    await t.test('Inactive and moved saved officials block readiness rather than silently substituting another user',async()=>{
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.official]);
      const invalid=await previewGanFromRecords(db,ids.admin,ids.app,{templateId:ids.template});assert.equal(invalid.ready,false);
      assert.ok(invalid.issues.some(issue=>issue.source.field==='authorized_official_id'));assert.ok((await orgRead()).warnings.length);
      await db.query("UPDATE users SET active_status='active',organization_id=$2 WHERE id=$1",[ids.official,ids.otherOrg]);
      assert.equal((await previewGanFromRecords(db,ids.admin,ids.app,{templateId:ids.template})).ready,false);
      await db.query('UPDATE users SET organization_id=$2 WHERE id=$1',[ids.official,ids.org]);
      await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.admin]);
      assert.equal((await previewGanFromRecords(db,ids.isc,ids.app,{templateId:ids.template})).ready,false);
      await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.admin]);
    });
    await t.test('Explicit print-only details remain available without inventing a portal account',async()=>{
      const saved=await granteeSave({approving_official_id:null,approving_official_name:'QA External Assistant Director',approving_official_title:'Assistant Director'});
      assert.equal(saved.official,null);const preview=await previewGanFromRecords(db,ids.admin,ids.app,{templateId:ids.template});assert.equal(preview.ready,true);
      assert.equal(preview.sources.approvingOfficialId,null);assert.equal(preview.values.approving_official_name,'QA External Assistant Director');
      await granteeSave({approving_official_id:ids.admin,approving_official_title:'Assistant Director'});
    });
    await t.test('Bulk plans fill saved defaults and reject changed organization or grantee settings',async()=>{
      const input=()=>({requestId:randomUUID(),nofoId:ids.nofo,templateId:ids.template,awardDate:'2026-10-29',applicationIds:[ids.secondApp]});
      const batch=await createGanBatch(db,ids.admin,input());const ready=await runGanBatch(db,ids.admin,batch.id);assert.equal(ready.counts.generated,1);
      const stale=await createGanBatch(db,ids.admin,input());await granteeSave({contact_title:'QA Senior Grant Coordinator'});
      const blocked=await runGanBatch(db,ids.admin,stale.id);assert.equal(blocked.counts.blocked,1);assert.ok(blocked.rows[0].result.reason.includes('Award-contact settings changed'));
      const next=await createGanBatch(db,ids.admin,input());await orgSave({authorized_official_id:ids.user});
      assert.ok((await runGanBatch(db,ids.admin,next.id)).rows[0].result.reason.includes('Award-contact settings changed'));await orgSave({authorized_official_id:ids.official});
    });
    await t.test('An audit failure rolls back the assignment and generic SQL cannot forge protected settings',async()=>{
      const before=await orgRead(),faulty={connect:async()=>{const client=await db.connect();return {release:()=>client.release(),query:(sql,args)=>sql.includes('INSERT INTO audit_logs')?Promise.reject(new Error('synthetic settings audit failure')):client.query(sql,args)};}};
      await assert.rejects(saveGanOrganizationSettings(faulty,ids.admin,ids.org,{expectedRevision:before.revision,authorized_official_id:ids.user}),/synthetic settings audit failure/);
      assert.equal((await orgRead()).revision,before.revision);assert.equal((await orgRead()).settings.authorized_official_id,before.settings.authorized_official_id);
      await assert.rejects(db.query('UPDATE organizations SET authorized_official_id=$2 WHERE id=$1',[ids.org,ids.user]),{code:'42501'});
      await assert.rejects(db.query("UPDATE grantees SET approving_official_name='Forged' WHERE id=$1",[ids.grantee]),{code:'42501'});
    });
    await t.test('Owned HTTP settings and the safe self-profile endpoint keep revisions, scope and legacy branding edits consistent',async()=>{
      const app=express(),authenticate=createAuthentication(db);app.use(express.json());app.use('/api/auth',createAuthRouter(db,async()=>{}));app.use('/api/gan/settings',createGanSettingsRouter(db,authenticate));
      app.use('/api/entities/:entity/:id?',authenticate,createGanSettingsEntityAccess(db));
      app.put('/api/entities/Grantee/:id',async(req,res)=>{const keys=Object.keys(req.body),row=(await db.query('UPDATE grantees SET '+keys.map((key,i)=>key+'=$'+(i+2)).join(',')+' WHERE id=$1 RETURNING *',[req.params.id,...Object.values(req.body)])).rows[0];res.json(row);});
      app.put('/api/entities/Organization/:id',(_req,res)=>res.json({unexpectedBypass:true}));
      server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
      const call=(path,who='admin',method='GET',body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{})},body:body?JSON.stringify(body):undefined});
      assert.equal((await call('/api/gan/settings/directory',null)).status,401);assert.equal((await call('/api/gan/settings/grantees/'+ids.grantee,'user')).status,403);
      const own=await call('/api/gan/settings/organizations/'+ids.org,'user');assert.equal(own.status,200);assert.equal((await own.json()).can_edit,false);assert.equal(own.headers.get('cache-control'),'private, no-store');
      assert.equal((await call('/api/entities/Organization/'+ids.org,'user','PUT',{authorized_official_id:ids.user})).status,403);
      const grantee=await granteeRead(),legacy=await call('/api/entities/Grantee/'+ids.grantee,'isc','PUT',{agency_name:'QA Updated Agency',gan_settings_revision:grantee.revision,...Object.fromEntries(['approving_official_id','approving_official_name','approving_official_title','contact_title'].map(key=>[key,grantee.settings[key]]))});
      assert.equal(legacy.status,200);assert.equal((await legacy.json()).gan_settings_revision,grantee.revision+1);
      assert.equal((await call('/api/entities/Grantee/'+ids.grantee,'isc','PUT',{agency_name:'Stale agency',gan_settings_revision:grantee.revision})).status,409);
      const profile=await call('/api/auth/me','official','PUT',{title:'QA Authorized Official',phone:'402-555-0199',role:'isc_admin',organization_id:ids.otherOrg});assert.equal(profile.status,200);
      const user=await profile.json();assert.equal(user.role,'user');assert.equal(user.organization_id,ids.org);assert.equal(user.title,'QA Authorized Official');
      assert.equal((await previewGanFromRecords(db,ids.admin,ids.app,{templateId:ids.template})).values.authorized_official_title,'QA Authorized Official');
    });
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
