import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import pg from 'pg';
import livePool from '../db/connection.js';
import {migrateAccountAccess} from '../services/accountMigration.js';
import {updateManagedAccount,bulkUpdateManagedAccounts} from '../services/accountUpdates.js';
import {previewAccountInvites,commitAccountInvites} from '../services/accountImport.js';
import {createAccountService} from '../services/accountService.js';
import {accountActor,listManagedAccounts,hashAccessToken} from '../services/accountRepository.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
import {createAccountRouter} from '../routes/accountAccess.js';
import {createUserMutationGuard} from '../middleware/userEntityAccess.js';
import {createAuthRouter} from '../routes/auth.js';

test('GMT account access against an isolated PostgreSQL schema',async t=>{
  const schema='gmt_qa_accounts_'+Date.now();
  assert.match(schema,/^gmt_qa_accounts_[0-9]+$/);
  await livePool.query('CREATE SCHEMA '+schema);
  const db=new pg.Pool({...livePool.options,options:'-c search_path='+schema+',public'});
  let server;
  try {
    for(const table of ['users','organizations','grantees','audit_logs']) {
      await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
    }
    await migrateAccountAccess(db);
    const ids=Object.fromEntries(['isc','neAdmin','ilAdmin','neUser','ilUser','reviewer','neOrg','ilOrg'].map(name=>[name,crypto.randomUUID()]));
    await db.query("INSERT INTO organizations(id,name,type,state) VALUES($1,'QA Nebraska','County','NE'),($2,'QA Illinois','County','IL')",[ids.neOrg,ids.ilOrg]);
    const hash=await bcrypt.hash('GMT-QA-password-2026',4);
    for(const [name,role,state,org] of [
      ['isc','isc_admin',null,null],['neAdmin','admin','NE',null],['ilAdmin','admin','IL',null],
      ['neUser','user','NE',ids.neOrg],['ilUser','user','IL',ids.ilOrg],['reviewer','reviewer','NE',null],
    ]) {
      await db.query(`INSERT INTO users(id,email,full_name,password_hash,role,scope_state,organization_id,active_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,'active')`,[ids[name],name+'@gmt-qa.invalid',name,hash,role,state,org]);
    }
    const sent=[];
    const send=async(user,token,purpose)=>sent.push({user,token,purpose});
    const service=createAccountService(db,send);
    const authenticate=createAuthentication(db);
    const app=express();app.use(express.json());
    app.use('/api/auth',createAuthRouter(db,async()=>{}));
    app.use('/api/accounts',createAccountRouter(db,send,authenticate));
    app.put('/api/entities/:entity/:id',authenticate,createUserMutationGuard(db),(req,res)=>res.json({allowed:true}));
    app.post('/api/entities/:entity',authenticate,createUserMutationGuard(db),(req,res)=>res.json({allowed:true}));
    app.get('/api/private',authenticate,(req,res)=>res.json({id:req.user.id}));
    server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const request=async(path,method='GET',body,token)=>{
      const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        body:body===undefined?undefined:JSON.stringify(body)});
      return {status:res.status,data:await res.json()};
    };
    const isc=(await db.query('SELECT * FROM users WHERE id=$1',[ids.isc])).rows[0];
    const admin=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neAdmin])).rows[0];
    const adminToken=generateToken(admin);
    await t.test('State administrators see and manage in-state subrecipients only',async()=>{
      const actor=await accountActor(db,ids.neAdmin);
      const list=await listManagedAccounts(db,actor);
      assert.deepEqual(list.map(row=>row.id),[ids.neUser]);
      await assert.rejects(service.reset(ids.neAdmin,ids.ilUser,{},'qa'),{status:403});
      await assert.rejects(service.reset(ids.neAdmin,ids.ilAdmin,{},'qa'),{status:403});
      await assert.rejects(service.reset(ids.reviewer,ids.neUser,{},'qa'),{status:403});
      await assert.rejects(service.invite(ids.neAdmin,{email:'elevate@gmt-qa.invalid',role:'admin',scope_state:'NE'},'qa'),{status:403});
      await assert.rejects(service.invite(ids.neAdmin,{email:'cross@gmt-qa.invalid',organization_id:ids.ilOrg},'qa'),{status:403});
    });
    await t.test('Invitation creates a hashed one-time link and preserves the administrator session',async()=>{
      const result=await request('/api/accounts/invite','POST',{email:' Invite@GMT-QA.invalid ',full_name:'Invite QA',organization_id:ids.neOrg},adminToken);
      assert.equal(result.status,200);assert.equal(result.data.user.email,'invite@gmt-qa.invalid');
      assert.equal(result.data.user.active_status,'invited');
      assert.equal(result.data.token,undefined);assert.equal(result.data.user.password_hash,undefined);
      const receipt=sent.at(-1);assert.equal(receipt.purpose,'invite');
      const rows=(await db.query('SELECT token_hash FROM account_access_tokens WHERE user_id=$1',[result.data.user.id])).rows;
      assert.equal(rows[0].token_hash,hashAccessToken(receipt.token));assert.notEqual(rows[0].token_hash,receipt.token);
      const me=await request('/api/auth/me','GET',undefined,adminToken);
      assert.equal(me.data.id,ids.neAdmin);
      const login=await request('/api/auth/login','POST',{email:'invite@gmt-qa.invalid',password:'anything'});
      assert.equal(login.status,401);
    });
    await t.test('Invitation is single use, activates account, and records actual login activity',async()=>{
      const receipt=sent.at(-1);
      const complete=await request('/api/accounts/complete','POST',{token:receipt.token,password:'New-GMT-QA-password-2026'});
      assert.equal(complete.status,200);
      assert.equal((await request('/api/accounts/complete','POST',{token:receipt.token,password:'Another-password-2026'})).status,400);
      const login=await request('/api/auth/login','POST',{email:receipt.user.email,password:'New-GMT-QA-password-2026'});
      assert.equal(login.status,200);assert.ok(login.data.user.last_login);
      assert.equal(login.data.user.password_hash,undefined);assert.equal(login.data.user.active_status,'active');
    });
    await t.test('Duplicate emails, missing organization, and weak passwords are blocked',async()=>{
      await assert.rejects(service.invite(ids.isc,{email:'NEUSER@gmt-qa.invalid',organization_id:ids.neOrg},'qa'),{status:409});
      await assert.rejects(service.invite(ids.isc,{email:'missing@gmt-qa.invalid'},'qa'),{status:400});
      await assert.rejects(service.complete('a'.repeat(64),'short','qa'),{status:400});
    });
    await t.test('Email failures roll back user, token, and audit changes',async()=>{
      const failure=createAccountService(db,async()=>{throw new Error('simulated mail failure');});
      const before=Number((await db.query('SELECT count(*) FROM audit_logs')).rows[0].count);
      await assert.rejects(failure.invite(ids.isc,{email:'rollback@gmt-qa.invalid',organization_id:ids.neOrg},'qa'));
      assert.equal((await db.query("SELECT id FROM users WHERE email='rollback@gmt-qa.invalid'")).rowCount,0);
      assert.equal(Number((await db.query('SELECT count(*) FROM audit_logs')).rows[0].count),before);
    });
    await t.test('Reset link expires after 24 hours and expired links cannot be used',async()=>{
      await service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa');
      const receipt=sent.at(-1);
      await db.query("UPDATE account_access_tokens SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1",[hashAccessToken(receipt.token)]);
      await assert.rejects(service.complete(receipt.token,'New-GMT-QA-password-2026','qa'),{status:400});
    });
    await t.test('Resending invalidates the previous link',async()=>{
      await service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa','invite');const first=sent.at(-1);
      await service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa','invite');const second=sent.at(-1);
      await assert.rejects(service.complete(first.token,'New-GMT-QA-password-2026','qa'),{status:400});
      await service.complete(second.token,'New-GMT-QA-password-2026','qa');
    });
    await t.test('Session revocation invalidates existing access tokens',async()=>{
      const target=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neUser])).rows[0];
      const token=generateToken(target);
      assert.equal((await request('/api/private','GET',undefined,token)).status,200);
      await service.reset(ids.isc,ids.neUser,{revoke_sessions:true},'qa');
      assert.equal((await request('/api/private','GET',undefined,token)).status,401);
    });
    await t.test('Temporary password requires a change before any other authenticated action',async()=>{
      const reset=await service.reset(ids.isc,ids.neUser,{method:'temporary',revoke_sessions:true},'qa');
      assert.ok(reset.temporary_password);
      const login=await request('/api/auth/login','POST',{email:'neUser@gmt-qa.invalid',password:reset.temporary_password});
      assert.equal(login.status,200);assert.equal(login.data.user.password_change_required,true);
      assert.equal((await request('/api/private','GET',undefined,login.data.token)).status,403);
      assert.equal((await request('/api/auth/me','GET',undefined,login.data.token)).status,200);
      assert.equal((await request('/api/accounts/change-password','POST',{password:'Changed-GMT-password-2026'},login.data.token)).status,200);
      assert.equal((await request('/api/private','GET',undefined,login.data.token)).status,401);
    });
    await t.test('Public registration cannot mint administrator accounts and profile cannot change scope',async()=>{
      const result=await request('/api/auth/register','POST',{email:'escalate@gmt-qa.invalid',password:'Fake-password-2026',role:'isc_admin'});
      assert.equal(result.status,403);
      const profile=await request('/api/auth/me','PUT',{organization_id:ids.ilOrg,grantee_id:'other'},adminToken);
      assert.equal(profile.status,400);
    });

    await t.test('Generic user endpoints cannot bypass state limits or reset session versions',async()=>{
      assert.equal((await request('/api/entities/User/'+ids.ilUser,'PUT',{role:'user'},adminToken)).status,403);
      assert.equal((await request('/api/entities/User/'+ids.neUser,'PUT',{auth_version:0},adminToken)).status,400);
      assert.equal((await request('/api/entities/User/'+ids.neUser,'PUT',{password_hash:'injected'},adminToken)).status,400);
      assert.equal((await request('/api/entities/User/'+ids.neUser,'PUT',{role:'isc_admin'},adminToken)).status,403);
      assert.equal((await request('/api/entities/User','POST',{email:'bypass@gmt-qa.invalid'},adminToken)).status,400);
    });
    await t.test('Concurrent redemption allows exactly one successful password change',async()=>{
      await service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa');
      const token=sent.at(-1).token;
      const results=await Promise.allSettled([
        service.complete(token,'Concurrent-password-2026','qa'),service.complete(token,'Concurrent-password-2027','qa')
      ]);
      assert.equal(results.filter(item=>item.status==='fulfilled').length,1);
      assert.equal(results.filter(item=>item.status==='rejected'&&item.reason.status===400).length,1);
    });
    await t.test('Concurrent reset requests leave only the newest committed link valid',async()=>{
      const start=sent.length;
      await Promise.all([service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa'),
        service.reset(ids.isc,ids.ilUser,{revoke_sessions:false},'qa')]);
      const receipts=sent.slice(start);
      assert.equal(receipts.length,2);
      const valid=(await db.query('SELECT token_hash FROM account_access_tokens WHERE user_id=$1 AND used_at IS NULL',[ids.ilUser])).rows;
      assert.equal(valid.length,1);
      assert.equal(valid[0].token_hash,hashAccessToken(receipts.at(-1).token));
    });
    await t.test('Failed reset delivery preserves the existing session',async()=>{
      const before=(await db.query('SELECT auth_version FROM users WHERE id=$1',[ids.ilUser])).rows[0].auth_version;
      const failure=createAccountService(db,async()=>{throw new Error('simulated rejection');});
      await assert.rejects(failure.reset(ids.isc,ids.ilUser,{revoke_sessions:true},'qa'));
      const after=(await db.query('SELECT auth_version FROM users WHERE id=$1',[ids.ilUser])).rows[0].auth_version;
      assert.equal(after,before);
    });

    await t.test('Existing user edit and deactivate actions remain scoped and revoke stale sessions',async()=>{
      await assert.rejects(updateManagedAccount(db,ids.neAdmin,ids.neUser,{organization_id:ids.ilOrg},'qa'),{status:403});
      const result=await updateManagedAccount(db,ids.neAdmin,ids.neUser,{phone:'555-QA-ONLY',active_status:'active',organization_id:ids.neOrg,role:'user',scope_state:'NE'},'qa');
      assert.equal(result.organization_name,'QA Nebraska');
      const user=(await db.query('SELECT * FROM users WHERE id=$1',[ids.neUser])).rows[0];
      const token=generateToken(user);
      await updateManagedAccount(db,ids.neAdmin,ids.neUser,{active_status:'inactive'},'qa');
      assert.equal((await request('/api/private','GET',undefined,token)).status,401);
      await updateManagedAccount(db,ids.neAdmin,ids.neUser,{active_status:'active'},'qa');
      assert.equal((await request('/api/private','GET',undefined,token)).status,401);
      await assert.rejects(updateManagedAccount(db,ids.isc,ids.neUser,{auth_version:0},'qa'),{status:400});
    });

    await t.test('Bulk status changes are atomic and retain state limits',async()=>{
      await assert.rejects(bulkUpdateManagedAccounts(db,ids.neAdmin,[ids.neUser,ids.ilUser],{active_status:'inactive'},'qa'),{status:403});
      const before=(await db.query('SELECT active_status FROM users WHERE id=$1',[ids.neUser])).rows[0];
      assert.equal(before.active_status,'active');
      const result=await bulkUpdateManagedAccounts(db,ids.isc,[ids.neUser,ids.ilUser],{active_status:'inactive'},'qa');
      assert.equal(result.updated,2);
      await bulkUpdateManagedAccounts(db,ids.isc,[ids.neUser,ids.ilUser],{active_status:'active'},'qa');
      await assert.rejects(bulkUpdateManagedAccounts(db,ids.isc,[ids.neUser,ids.neUser],{active_status:'inactive'},'qa'),{status:400});
      await assert.rejects(bulkUpdateManagedAccounts(db,ids.isc,[ids.neUser],{auth_version:0},'qa'),{status:400});
    });
    await t.test('ISC user import dry run creates no accounts or messages',async()=>{
      const rows=[{email:'bulk-ready@gmt-qa.invalid',name:'Bulk Ready',organization_name:'QA Nebraska',scope_state:'NE',phone:'555-QA-ONLY'},
        {email:'bad-email',organization_name:'QA Nebraska'},{email:'neUser@gmt-qa.invalid',organization_name:'QA Nebraska'}];
      const before=Number((await db.query('SELECT count(*) FROM users')).rows[0].count),mailBefore=sent.length;
      const preview=await previewAccountInvites(db,ids.isc,rows);
      assert.equal(preview.valid,1);assert.equal(preview.invalid,2);
      assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0].count),before);assert.equal(sent.length,mailBefore);
      await assert.rejects(previewAccountInvites(db,ids.neAdmin,rows),{status:403});
      const committed=await commitAccountInvites(db,send,ids.isc,rows,preview.fingerprint,'qa');
      assert.equal(committed.succeeded,1);assert.equal(committed.failed,2);assert.equal(sent.length,mailBefore+1);
      const user=(await db.query("SELECT * FROM users WHERE email='bulk-ready@gmt-qa.invalid'")).rows[0];
      assert.equal(user.organization_id,ids.neOrg);assert.equal(user.phone,'555-QA-ONLY');
      assert.equal(user.active_status,'invited');
    });
    await t.test('Changed input or state after dry run requires another preview',async()=>{
      const rows=[{email:'bulk-change@gmt-qa.invalid',organization_name:'QA Nebraska'}];
      const preview=await previewAccountInvites(db,ids.isc,rows);
      await assert.rejects(commitAccountInvites(db,send,ids.isc,[{...rows[0],email:'tampered@gmt-qa.invalid'}],preview.fingerprint,'qa'),{status:409});
      await service.invite(ids.isc,{email:rows[0].email,organization_id:ids.neOrg},'qa');
      await assert.rejects(commitAccountInvites(db,send,ids.isc,rows,preview.fingerprint,'qa'),{status:409});
      const bad=await previewAccountInvites(db,ids.isc,[{email:'scope-bad@gmt-qa.invalid',organization_id:ids.neOrg,scope_state:'IL'}]);
      assert.equal(bad.valid,0);
    });
    await t.test('Bulk invite reports delivery failures without saving failed accounts',async()=>{
      const rows=[{email:'bulk-ok2@gmt-qa.invalid',organization_name:'QA Nebraska'},{email:'bulk-fail@gmt-qa.invalid',organization_name:'QA Nebraska'}];
      const preview=await previewAccountInvites(db,ids.isc,rows);
      const result=await commitAccountInvites(db,async(user,token,purpose)=>{
        if(user.email==='bulk-fail@gmt-qa.invalid')throw new Error('simulated provider failure');
        await send(user,token,purpose);
      },ids.isc,rows,preview.fingerprint,'qa');
      assert.equal(result.succeeded,1);assert.equal(result.failed,1);
      assert.equal((await db.query("SELECT id FROM users WHERE email='bulk-fail@gmt-qa.invalid'")).rowCount,0);
      assert.ok(!JSON.stringify(result).includes('password_hash'));
    });
    await t.test('Audit history covers invitations, reset requests, and completion without credential leakage',async()=>{
      const {rows}=await db.query('SELECT action,description FROM audit_logs');
      for(const action of ['UserInvited','PasswordResetRequested','InviteResent','PasswordChanged'])assert.ok(rows.some(row=>row.action===action),action);
      for(const receipt of sent)assert.ok(!JSON.stringify(rows).includes(receipt.token));
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.end();
    await livePool.query('DROP SCHEMA '+schema+' CASCADE');
    await livePool.end();
  }
});
