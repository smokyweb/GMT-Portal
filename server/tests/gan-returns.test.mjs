import {listGanWorkflows} from '../services/documents/ganWorkflowCatalog.js';
import {prepareGanReturnAction} from '../services/documents/ganReturnActions.js';
import {ganWorkflowAccess} from '../services/documents/ganWorkflowAccess.js';
import {loadGanIssue} from '../services/documents/ganWorkflowIntegrity.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import express from 'express';
import {PDFDocument,PDFName,PDFString} from 'pdf-lib';
import live from '../db/connection.js';
import {seedGanDraftDatabase} from './fixtures/ganDraftDatabase.mjs';
import {migrateGanSettings} from '../services/documents/ganSettingsMigration.js';
import {migrateGanPackages} from '../services/documents/ganPackageMigration.js';
import {migrateGanWorkflow} from '../services/documents/ganWorkflowMigration.js';
import {migrateGanReturns} from '../services/documents/ganReturnMigration.js';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {saveGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
import {saveGanSignatureSettings} from '../services/documents/ganSignatureSettings.js';
import {saveGanReturnUpload} from '../services/documents/ganReturnUploads.js';
import {readGanReturnUpload,readGanReturnSubmission} from '../services/documents/ganReturnRead.js';
import {transitionGan} from '../services/documents/ganWorkflow.js';
import {readGanWorkflow} from '../services/documents/ganWorkflowRead.js';
import {GAN_RETURN_CHECKLIST} from '../services/documents/ganReturnPolicy.js';
import {assertGanFundingReady} from '../services/documents/ganFundingGate.js';
import {loadGanAttachmentPdf} from '../services/documents/pdf/ganAttachmentPdf.js';
import {createGanReturnsRouter} from '../routes/ganReturns.js';
import {createGanWorkflowRouter} from '../routes/ganWorkflow.js';
import {createAuthentication,generateToken} from '../middleware/auth.js';
import {ganPackageHash} from '../services/documents/ganPackagePolicy.js';
test('Private signed originals, complete submissions and NEMA accept/return',async t=>{
 const schema='gmt_qa_gan_returns_'+Date.now();await live.query('CREATE SCHEMA '+schema);const db=new pg.Pool({...live.options,options:'-c search_path='+schema+',public'});let server;
 try{
  const {ids,selection}=await seedGanDraftDatabase(db,schema);
  for(const table of ['notifications','workflow_rules'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
  await migrateGanSettings(db);await migrateGanPackages(db);await migrateGanWorkflow(db);await migrateGanReturns(db);
  const makePdf=async(label,pages=1)=>{const pdf=await PDFDocument.create();for(let i=0;i<pages;i++)pdf.addPage([612,792]).drawText(label+' - page '+(i+1),{x:40,y:700});return Buffer.from(await pdf.save());};
  const signed=await makePdf('QA SIGNED ORIGINAL - SYNTHETIC ONLY'),conditionBytes=await makePdf('QA CONDITIONS - SYNTHETIC ONLY',3);
  const conditions=(await saveGanAttachment(db,ids.admin,ids.nofo,{requestId:randomUUID(),kind:'special_conditions',title:'QA Conditions',signaturePages:[2,3]},conditionBytes)).attachment;
  const deposit=(await saveGanAttachment(db,ids.admin,ids.nofo,{requestId:randomUUID(),kind:'direct_deposit',title:'QA Blank Deposit - no bank data',signaturePages:[]},await makePdf('QA BLANK DEPOSIT - SYNTHETIC ONLY'))).attachment;
  const docs={},issues={},uploads={};let submitted,accepted;
  const req=revision=>({requestId:randomUUID(),expectedRevision:revision});
  const state=key=>readGanWorkflow(db,ids.official,docs[key].id);
  async function make(key='app'){
    const doc=(await saveGanDraft(db,ids.admin,ids[key],{...req(0),...selection})).document;
    const pack=(await saveGanPackage(db,ids.admin,doc.id,{requestId:randomUUID(),expectedGanRevision:1,expectedPackageRevision:0,conditionsId:conditions.id,...(key==='secondApp'?{depositId:deposit.id}:{})})).package;
    docs[key]=doc;issues[key]=(await transitionGan(db,ids.admin,doc.id,'send',{...req(0),packageId:pack.id},'127.0.0.1')).issue;
    await transitionGan(db,ids.official,doc.id,'open',req(1),'203.0.113.2');
  }
  const put=async(key,kind,sourcePages,bytes=signed,who=ids.official,override={})=>saveGanReturnUpload(db,who,docs[key].id,{...req((await state(key)).revision),kind,sourcePages,...override},bytes,'signed-'+kind+'.pdf','203.0.113.2');
  const submissionInput=(key,idsList,revision=2)=>({...req(revision),uploadIds:idsList,name:'QA official',title:'QA Authorized Official',signedDate:'2026-10-29',confirmed:true,issuedPdfSha256:issues[key].pdf_sha256});
  const submit=(key,input)=>transitionGan(db,ids.official,docs[key].id,'submit_upload',input,'203.0.113.2');
  const checks=Object.fromEntries(Object.keys(GAN_RETURN_CHECKLIST).map(key=>[key,true]));
  const verification=(event,revision=3,extra={})=>({...req(revision),submissionId:event.event.evidence.submissionId,issuedPdfSha256:event.issue.pdf_sha256,uploadedPdfSha256:event.event.evidence.uploadedPdfSha256,...extra});
  const counts=async()=>({uploads:(await db.query('SELECT count(*)::int AS n FROM gan_return_uploads')).rows[0].n,submissions:(await db.query('SELECT count(*)::int AS n FROM gan_return_submissions')).rows[0].n,events:(await db.query('SELECT count(*)::int AS n FROM gan_workflow_events')).rows[0].n,alerts:(await db.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n,delivery:(await db.query('SELECT count(*)::int AS n FROM gan_workflow_delivery')).rows[0].n});
  await t.test('Migration is isolated/idempotent and uploaded mappings reflect issued required pages',async()=>{
    await migrateGanReturns(db);await make();
    await saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:0,allowedMethods:['upload']});await make('secondApp');
    await saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:1,allowedMethods:['electronic','upload']});
    assert.equal((await db.query("SELECT to_regclass('public.gan_return_uploads') AS name")).rows[0].name,null);
    const current=await state('app');assert.equal(current.returns.canUpload,true);assert.equal(current.returns.canVerify,false);
    assert.deepEqual(current.returns.parts.find(part=>part.kind==='special_conditions').signaturePages,[2,3]);
    assert.equal(current.returns.parts.find(part=>part.kind==='gan').required,true);
  });
  await t.test('Only the current active official can upload, using current revision and allowed methods',async()=>{
    for(const who of [ids.user,ids.otherUser,ids.admin,ids.reviewer])await assert.rejects(put('app','gan',[1],signed,who),{status:403});
    await assert.rejects(put('app','gan',[1],signed,ids.official,{expectedRevision:0}),{status:409});
    await db.query("UPDATE users SET active_status='inactive' WHERE id=$1",[ids.official]);await assert.rejects(put('app','gan',[1]),{status:401});await db.query("UPDATE users SET active_status='active' WHERE id=$1",[ids.official]);
    await saveGanSignatureSettings(db,ids.isc,ids.template,{expectedRevision:2,allowedMethods:['electronic']});await make('legacyApp');
    await assert.rejects(put('legacyApp','gan',[1]),{status:403});assert.equal((await state('legacyApp')).returns.canUpload,false);
    assert.deepEqual(issues.secondApp.allowed_methods,['upload']);
    await assert.rejects(transitionGan(db,ids.official,docs.secondApp.id,'sign',{...req(2),name:'QA official',title:'QA Official',consentElectronic:true,consentConditions:true,consentAuthority:true,issuedPdfSha256:issues.secondApp.pdf_sha256}),{status:403});
  });
  await t.test('Rejects malformed, encrypted, active, oversized and incorrectly mapped files without storing them',async()=>{
    const before=await counts();await assert.rejects(put('app','gan',[1],Buffer.from('not a PDF')),{status:400});
    const bad=await PDFDocument.create();bad.addPage([612,792]);bad.catalog.set(PDFName.of('JS'),PDFString.of('app.alert("no")'));
    await assert.rejects(put('app','gan',[1],Buffer.from(await bad.save())),{status:422});
    const encrypted=await PDFDocument.create();encrypted.addPage([612,792]);encrypted.context.trailerInfo.Encrypt=encrypted.context.register(encrypted.context.obj({Filter:PDFName.of('Standard'),V:2,R:3}));
    await assert.rejects(put('app','gan',[1],Buffer.from(await encrypted.save())),{status:422});
    const huge=Buffer.alloc(10*1024*1024+1);huge.write('%PDF-1.7');await assert.rejects(put('app','gan',[1],huge),{status:400});
    await assert.rejects(put('app','gan',[1,1],await makePdf('QA',2)),{status:400});
    await assert.rejects(put('app','gan',[2]),{status:422});await assert.rejects(put('app','special_conditions',[2,3]),{status:422});
    await assert.rejects(put('app','direct_deposit',[1]),{status:400});assert.deepEqual(await counts(),before);
  });
  await t.test('A real authenticated multipart request stores a private immutable original',async()=>{
    const app=express(),auth=createAuthentication(db);app.use(express.json());app.use('/api/gan',createGanReturnsRouter(db,auth));app.use('/api/gan',createGanWorkflowRouter(db,auth));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const form=new FormData();for(const [key,value] of Object.entries({...req(2),kind:'gan',sourcePages:JSON.stringify([1])}))form.append(key,String(value));form.append('file',new Blob([signed],{type:'application/pdf'}),'browser-signed.pdf');
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/gan/documents/'+docs.secondApp.id+'/return-uploads',{method:'POST',headers:{Authorization:'Bearer '+generateToken({id:ids.official})},body:form});assert.equal(response.status,201);
    const body=await response.json();assert.equal(body.upload.kind,'gan');assert.deepEqual((await readGanReturnUpload(db,ids.official,body.upload.id)).pdf,signed);
    uploads.deposit=(await put('secondApp','direct_deposit',[1],await makePdf('QA COMPLETED DEPOSIT - NO BANK DATA'))).upload;
    for(const who of [ids.user,ids.otherAdmin])await assert.rejects(readGanReturnUpload(db,who,uploads.deposit.id),{status:403});
  });
  await t.test('Original bytes, request retries and versions are immutable and scope checked on reads',async()=>{
    const input={...req(2),kind:'gan',sourcePages:[1]},first=await saveGanReturnUpload(db,ids.official,docs.app.id,input,signed,'../signed.pdf','203.0.113.2');
    uploads.gan=first.upload;assert.equal(first.upload.filename,'signed.pdf');assert.equal((await saveGanReturnUpload(db,ids.official,docs.app.id,input,signed,'../signed.pdf')).replayed,true);
    await assert.rejects(saveGanReturnUpload(db,ids.official,docs.app.id,input,await makePdf('DIFFERENT'),'../signed.pdf'),{status:409});
    const original=await readGanReturnUpload(db,ids.official,first.upload.id);assert.deepEqual(original.pdf,signed);assert.equal(original.pdf_sha256,ganPackageHash(signed));
    for(const who of [ids.user,ids.otherUser,ids.otherAdmin])await assert.rejects(readGanReturnUpload(db,who,first.upload.id),{status:403});
    assert.deepEqual((await readGanReturnUpload(db,ids.admin,first.upload.id)).pdf,signed);
    await assert.rejects(db.query("UPDATE gan_return_uploads SET filename='changed' WHERE id=$1",[first.upload.id]),{code:'42501'});
    await assert.rejects(db.query('DELETE FROM gan_return_uploads WHERE id=$1',[first.upload.id]),{code:'42501'});
  });
  await t.test('Completeness requires every declared signature page, latest versions and exact issued recipient/hash',async()=>{
    uploads.partial=(await put('app','special_conditions',[2])).upload;
    await assert.rejects(submit('app',submissionInput('app',[uploads.gan.id,uploads.partial.id])),{status:422});
    uploads.conditions=(await put('app','special_conditions',[2,3],await makePdf('QA CONDITIONS SIGNATURES',2))).upload;
    const good=submissionInput('app',[uploads.gan.id,uploads.conditions.id]);
    for(const extra of [{confirmed:false},{name:'Another signer'},{issuedPdfSha256:'0'.repeat(64)},{signedDate:'2026-02-30'},{signedDate:'2099-01-01'},{signedDate:'2025-01-01'}])await assert.rejects(submit('app',{...good,...extra}),error=>[400,409].includes(error.status));
    await assert.rejects(submit('app',{...good,uploadIds:[uploads.gan.id,uploads.partial.id]}),{status:422});
    const older=uploads.conditions;uploads.conditions=(await put('app','special_conditions',[2,3],await makePdf('QA NEW CONDITIONS SIGNATURES',2))).upload;
    await assert.rejects(submit('app',{...good,uploadIds:[uploads.gan.id,older.id]}),{status:409});
    uploads.other=(await put('secondApp','gan',[1])).upload;
    await assert.rejects(submit('app',{...good,uploadIds:[uploads.gan.id,uploads.other.id]}),{status:403});
    assert.equal((await state('app')).phase,'Reviewed');
  });
  await t.test('Submission is atomic, retry safe, unverified and keeps originals separate from its review PDF',async()=>{
    const input=submissionInput('app',[uploads.gan.id,uploads.conditions.id]);submitted=await submit('app',input);assert.equal(submitted.phase,'Uploaded');assert.equal(submitted.fullyExecuted,false);assert.equal((await submit('app',input)).replayed,true);
    const current=await state('app');assert.equal(current.returns.canUpload,false);assert.equal(current.canAct,false);
    const artifact=await readGanReturnSubmission(db,ids.admin,submitted.event.evidence.submissionId);assert.equal((await PDFDocument.load(artifact.pdf)).getPageCount(),3);
    assert.deepEqual(artifact.submission.manifest.parts.map(part=>part.kind),['gan','special_conditions']);assert.equal(artifact.pdf_sha256,submitted.event.evidence.uploadedPdfSha256);
    assert.equal((await readGanWorkflow(db,ids.admin,docs.app.id)).returns.canVerify,true);
    await assert.rejects(put('app','gan',[1]),{status:409});await assert.rejects(assertGanFundingReady(db,ids.app),{status:409});
    const doc=(await db.query('SELECT status,signed_by,signed_at FROM generated_documents WHERE id=$1',[docs.app.id])).rows[0];assert.equal(doc.status,'Uploaded');assert.equal(doc.signed_by,null);assert.equal(doc.signed_at,null);
    for(const who of [ids.user,ids.otherAdmin])await assert.rejects(readGanReturnSubmission(db,who,artifact.submission.id),{status:403});
    fs.mkdirSync('../output/pdf/gan-returns',{recursive:true});fs.writeFileSync('../output/pdf/gan-returns/qa-submitted-copy.pdf',artifact.pdf);fs.writeFileSync('../output/pdf/gan-returns/qa-original-gan.pdf',signed);
  });
  await t.test('Assigned reviewers can verify, while a conflicting grantee assignment cannot list or read private returns',async()=>{
    assert.equal((await readGanWorkflow(db,ids.reviewer,docs.app.id)).returns.canVerify,true);
    assert.ok((await listGanWorkflows(db,ids.reviewer)).documents.some(row=>row.id===docs.app.id));
    await db.query('UPDATE users SET grantee_id=$2 WHERE id=$1',[ids.reviewer,ids.otherGrantee]);
    try{const hidden=(await readGanWorkflow(db,ids.reviewer,docs.app.id)).returns;assert.equal(hidden.canVerify,false);assert.deepEqual(hidden.uploads,[]);assert.deepEqual(hidden.submissions,[]);assert.deepEqual((await listGanWorkflows(db,ids.reviewer)).documents,[]);await assert.rejects(readGanReturnSubmission(db,ids.reviewer,submitted.event.evidence.submissionId),{status:403});}
    finally{await db.query('UPDATE users SET grantee_id=NULL WHERE id=$1',[ids.reviewer]);}
  });
  await t.test('NEMA verification requires assigned staff, six checks, the current submission and both exact hashes',async()=>{
    const good=verification(submitted,3,{checklist:checks});
    for(const who of [ids.official,ids.user,ids.otherAdmin])await assert.rejects(transitionGan(db,who,docs.app.id,'accept_upload',good),{status:403});
    for(const extra of [{checklist:{...checks,termsUnchanged:false}},{checklist:{awardNumberAmount:true}},{uploadedPdfSha256:'0'.repeat(64)},{issuedPdfSha256:'0'.repeat(64)},{submissionId:randomUUID()}])await assert.rejects(transitionGan(db,ids.admin,docs.app.id,'accept_upload',{...good,...extra}),error=>[400,404,409].includes(error.status));
    await assert.rejects(transitionGan(db,ids.admin,docs.app.id,'return_upload',verification(submitted,3,{note:' '})),{status:400});assert.equal((await state('app')).phase,'Uploaded');
  });
  await t.test('Returning records correction notes and only reopens the same assigned official’s upload path',async()=>{
    const input=verification(submitted,3,{note:'QA: complete the date and both Special Conditions signatures.'});
    const returned=await transitionGan(db,ids.reviewer,docs.app.id,'return_upload',input,'198.51.100.2');assert.equal(returned.phase,'UploadReturned');assert.equal((await transitionGan(db,ids.reviewer,docs.app.id,'return_upload',input)).replayed,true);
    const current=await state('app');assert.equal(current.returns.canUpload,true);assert.equal(current.returns.canVerify,false);assert.equal(current.events[0].evidence.note,input.note);
    assert.equal((await db.query('SELECT subrecipient_notes FROM generated_documents WHERE id=$1',[docs.app.id])).rows[0].subrecipient_notes,input.note);
    await assert.rejects(transitionGan(db,ids.admin,docs.app.id,'accept_upload',verification(submitted,4,{checklist:checks})),{status:409});
  });
  await t.test('Resubmission freezes the corrected version and preserves the first originals, manifest and review copy',async()=>{
    const old=await readGanReturnSubmission(db,ids.official,submitted.event.evidence.submissionId),corrected=(await put('app','gan',[1],await makePdf('QA CORRECTED SIGNED GAN'))).upload;
    const second=await submit('app',submissionInput('app',[corrected.id,uploads.conditions.id],4));
    assert.equal(second.phase,'Uploaded');assert.equal(second.event.evidence.submissionNumber,2);
    assert.deepEqual((await readGanReturnSubmission(db,ids.official,old.submission.id)).pdf,old.pdf);
    assert.deepEqual((await readGanReturnUpload(db,ids.official,uploads.gan.id)).pdf,signed);
    await assert.rejects(transitionGan(db,ids.admin,docs.app.id,'accept_upload',verification(submitted,5,{checklist:checks})),{status:409});
    const acceptInput=verification(second,5,{checklist:checks,note:'QA verified against the issued package.'});
    accepted=await transitionGan(db,ids.admin,docs.app.id,'accept_upload',acceptInput,'198.51.100.3');
    assert.equal(accepted.phase,'Verified');assert.equal(accepted.fullyExecuted,false);
    const doc=(await db.query('SELECT status,signed_by,signed_at FROM generated_documents WHERE id=$1',[docs.app.id])).rows[0];assert.equal(doc.status,'Verified');assert.equal(doc.signed_by,'official@gan-draft-qa.invalid');assert.equal(doc.signed_at.toISOString(),second.event.evidence.recipient.received_at);
    await assert.rejects(assertGanFundingReady(db,ids.app),{status:409});
    assert.equal((await transitionGan(db,ids.admin,docs.app.id,'accept_upload',acceptInput)).replayed,true);
    const current=await state('app');assert.equal(current.returns.submissions.length,2);assert.equal(current.returns.canUpload,false);
  });
  await t.test('Audit failures roll back uploads, submissions, transitions and pending notices',async()=>{
    const before=await counts();await db.query("CREATE FUNCTION qa_fail_return_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('GANSignedPagesUploaded','GANSignedDocumentsSubmitted') THEN RAISE EXCEPTION 'QA forced audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER qa_fail_return_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION qa_fail_return_audit()");
    try{await assert.rejects(put('secondApp','special_conditions',[2,3],await makePdf('QA SIGS',2)));assert.deepEqual(await counts(),before);}finally{await db.query('DROP TRIGGER qa_fail_return_audit ON audit_logs');}
    const sc=(await put('secondApp','special_conditions',[2,3],await makePdf('QA SIGS',2))).upload,beforeSubmit=await counts();
    await db.query('CREATE TRIGGER qa_fail_return_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION qa_fail_return_audit()');
    try{await assert.rejects(submit('secondApp',submissionInput('secondApp',[uploads.other.id,sc.id,uploads.deposit.id])));assert.deepEqual(await counts(),beforeSubmit);}finally{await db.query('DROP TRIGGER qa_fail_return_audit ON audit_logs');}
    const client=await db.connect();try{
      await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','workflow',true)");
      const access=await ganWorkflowAccess(client,ids.official,docs.secondApp.id,{lock:true}),master=(await client.query('SELECT * FROM gan_workflows WHERE document_id=$1',[docs.secondApp.id])).rows[0];
      await prepareGanReturnAction(client,access,await loadGanIssue(client,master.issue_id),master,'submit_upload',submissionInput('secondApp',[uploads.other.id,sc.id,uploads.deposit.id]),new Date().toISOString());
      await assert.rejects(client.query('COMMIT'),{code:'23514'});
    }finally{await client.query('ROLLBACK');client.release();}
    assert.deepEqual(await counts(),beforeSubmit);
    uploads.secondConditions=sc;
  });
  await t.test('Concurrent accept versus return commits exactly one action, with retry-safe staff replay',async()=>{
    const sent=await submit('secondApp',submissionInput('secondApp',[uploads.other.id,uploads.secondConditions.id,uploads.deposit.id])),acceptInput=verification(sent,3,{checklist:checks}),returnInput=verification(sent,3,{note:'QA correction.'});
    const submittedCopy=await readGanReturnSubmission(db,ids.admin,sent.event.evidence.submissionId);assert.deepEqual(submittedCopy.submission.manifest.parts.map(part=>part.kind),['gan','special_conditions','direct_deposit']);
    const before=await counts();
    await db.query("CREATE FUNCTION qa_fail_return_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA forced delivery queue failure'; END $$; CREATE TRIGGER qa_fail_return_delivery BEFORE INSERT ON gan_workflow_delivery FOR EACH ROW EXECUTE FUNCTION qa_fail_return_delivery()");
    try{await assert.rejects(transitionGan(db,ids.admin,docs.secondApp.id,'accept_upload',acceptInput));assert.deepEqual(await counts(),before);assert.equal((await state('secondApp')).phase,'Uploaded');}finally{await db.query('DROP TRIGGER qa_fail_return_delivery ON gan_workflow_delivery');}
    const client=await db.connect();try{
      await client.query('BEGIN');await client.query("SELECT set_config('gmt.gan_action','workflow',true)");
      const evidence={...sent.event.evidence,checklist:checks,note:''};
      await assert.rejects(client.query("INSERT INTO gan_workflow_events(id,document_id,issue_id,revision,request_id,request_sha256,action,from_phase,to_phase,actor_id,actor_role,actor_email,occurred_at,ip,evidence,evidence_sha256) VALUES($1,$2,$3,4,$4,'QA forged','accept_upload','Uploaded','Verified',$5,'admin','otherAdmin@gan-draft-qa.invalid',NOW(),'127.0.0.1',$6,encode(sha256(convert_to($6::jsonb::text,'UTF8')),'hex'))",[randomUUID(),docs.secondApp.id,issues.secondApp.id,randomUUID(),ids.otherAdmin,JSON.stringify(evidence)]),{code:'42501'});
    }finally{await client.query('ROLLBACK');client.release();}
    const results=await Promise.allSettled([transitionGan(db,ids.admin,docs.secondApp.id,'accept_upload',acceptInput),transitionGan(db,ids.reviewer,docs.secondApp.id,'return_upload',returnInput)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);const failed=results.find(result=>result.status==='rejected');assert.equal(failed.reason.status,409);
    const won=results[0].status==='fulfilled',replay=await transitionGan(db,won?ids.admin:ids.reviewer,docs.secondApp.id,won?'accept_upload':'return_upload',won?acceptInput:returnInput);assert.equal(replay.replayed,true);
  });
  await t.test('Private originals preserve signed PDF dictionaries while blank source attachments still reject them',async()=>{
    const pdf=await PDFDocument.create();pdf.addPage([612,792]);const sig=pdf.context.obj({FT:PDFName.of('Sig'),V:pdf.context.obj({Type:PDFName.of('Sig'),Contents:PDFString.of('QA synthetic certificate bytes')})});pdf.context.register(sig);
    const bytes=Buffer.from(await pdf.save());await assert.rejects(loadGanAttachmentPdf(bytes),{status:422});await loadGanAttachmentPdf(bytes,{allowSignatures:true});
    assert.equal((await db.query("SELECT count(*)::int AS n FROM gan_workflow_delivery WHERE status<>'pending'")).rows[0].n,0);
  });
  await t.test('HTTP multipart uploads and private original/review downloads require authorized identities',async()=>{
    const base='http://127.0.0.1:'+server.address().port;
    const call=(path,who='official')=>fetch(base+path,{headers:who?{Authorization:'Bearer '+generateToken({id:ids[who]})}:{}});
    assert.equal((await call('/api/gan/return-uploads/'+uploads.gan.id+'/pdf',null)).status,401);assert.equal((await call('/api/gan/return-uploads/'+uploads.gan.id+'/pdf','user')).status,403);
    const original=await call('/api/gan/return-uploads/'+uploads.gan.id+'/pdf?download=1');assert.equal(original.headers.get('cache-control'),'private, no-store');assert.equal(original.headers.get('x-content-type-options'),'nosniff');assert.equal(original.headers.get('x-gmt-document-sha256'),ganPackageHash(signed));assert.ok(original.headers.get('content-disposition').startsWith('attachment'));assert.deepEqual(Buffer.from(await original.arrayBuffer()),signed);
    const review=await call('/api/gan/return-submissions/'+submitted.event.evidence.submissionId+'/pdf','admin');assert.equal(review.status,200);assert.equal(ganPackageHash(Buffer.from(await review.arrayBuffer())),review.headers.get('x-gmt-document-sha256'));
    const audits=(await db.query("SELECT action FROM audit_logs WHERE action IN ('GANSignedOriginalDownloaded','GANSignedSubmissionPreviewed')")).rows;assert.equal(audits.length,2);
  });
  await t.test('SQL guards prevent mutation, orphan submissions, forged states and corrupt reads',async()=>{
    const id=submitted.event.evidence.submissionId;
    for(const sql of ["UPDATE gan_return_submissions SET manifest='{}' WHERE id=$1","DELETE FROM gan_return_submissions WHERE id=$1"])await assert.rejects(db.query(sql,[id]),{code:'42501'});
    await assert.rejects(db.query("UPDATE gan_workflows SET phase='Verified' WHERE document_id=$1",[docs.app.id]),{code:'42501'});
    const client=await db.connect();try{await client.query('BEGIN');await client.query('ALTER TABLE gan_return_uploads DISABLE TRIGGER protect_gan_return_upload');await client.query("UPDATE gan_return_uploads SET pdf='corrupt'::bytea WHERE id=$1",[uploads.gan.id]);await assert.rejects(readGanReturnUpload(client,ids.admin,uploads.gan.id),{status:500});}finally{await client.query('ROLLBACK');client.release();}
    const other=await db.connect();try{await other.query('BEGIN');await other.query('ALTER TABLE gan_return_submissions DISABLE TRIGGER protect_gan_return_submission');await other.query("UPDATE gan_return_submissions SET manifest=manifest||'{\"confirmed\":false}'::jsonb WHERE id=$1",[id]);await assert.rejects(readGanReturnSubmission(other,ids.admin,id),{status:500});}finally{await other.query('ROLLBACK');other.release();}
  });
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();await live.query('DROP SCHEMA '+schema+' CASCADE');await live.end();}
});
