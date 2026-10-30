import {prepareGanReturnAction} from './ganReturnActions.js';
import {ganReturnActions} from './ganReturnPolicy.js';
import {assertGanVerifier} from './ganReturnAccess.js';
import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ganWorkflowAccess,assertGanRecipient,assertGanSender} from './ganWorkflowAccess.js';
import {ganWorkflowRequest,ganWorkflowFingerprint,ganNameKey,GAN_SIGNATURE_CONSENTS,publicGanIssue} from './ganWorkflowPolicy.js';
import {loadGanIssue,verifyGanWorkflowEvent,ganWorkflowEventProjection} from './ganWorkflowIntegrity.js';
import {prepareGanIssue} from './ganIssuePreparation.js';
import {renderGanIssuedPackage} from './ganIssuePdf.js';
import {queueGanWorkflowNotices} from './ganWorkflowNotices.js';
export async function transitionGan(pool,actorId,documentId,action,input,observedIp='') {
  const request=ganWorkflowRequest(action,input),fingerprint=ganWorkflowFingerprint(actorId,documentId,action,request),db=await pool.connect();
  try{
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const access=await ganWorkflowAccess(db,actorId,documentId,{lock:true}),{actor,document}=access;
    const master=(await db.query('SELECT * FROM gan_workflows WHERE document_id=$1 FOR UPDATE',[document.id])).rows[0];
    const previous=(await db.query("SELECT *,encode(sha256(convert_to(evidence::text,'UTF8')),'hex') AS calculated_evidence_sha256 FROM gan_workflow_events WHERE document_id=$1 AND request_id=$2",[document.id,request.requestId])).rows[0];
    if(previous){
      if(previous.request_sha256!==fingerprint)throw accountError(409,'This action request ID was already used for a different GAN action');
      const issue=await loadGanIssue(db,previous.issue_id);if(action==='send')assertGanSender(access);else if(['accept_upload','return_upload'].includes(action))assertGanVerifier(access,issue);else assertGanRecipient(access,issue);verifyGanWorkflowEvent(previous);
      await db.query('COMMIT');return {event:ganWorkflowEventProjection(previous),issue:publicGanIssue(issue),phase:previous.to_phase,revision:previous.revision,replayed:true,fullyExecuted:false};
    }
    if(request.expectedRevision!==(master?.revision||0))throw accountError(409,'The GAN workflow changed. Reload before continuing.');
    const now=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString(),ip=String(observedIp||'').slice(0,100),eventId=randomUUID(),revision=(master?.revision||0)+1;
    await db.query("SELECT set_config('gmt.gan_action','workflow',true)");
    let issue,phase,evidence={},artifact=null,fromPhase=document.status==='Draft'?'Draft':master?.phase;
    if(action==='send'){
      assertGanSender(access);issue=await prepareGanIssue(db,access,request.packageId,now);phase='Sent';evidence={packageId:request.packageId,issuedPdfSha256:issue.pdf_sha256};
    }else if(ganReturnActions.includes(action)){
      if(!master)throw accountError(409,'This GAN has no current issued package');
      issue=await loadGanIssue(db,master.issue_id);({phase,evidence,artifact}=await prepareGanReturnAction(db,access,issue,master,action,request,now));
    }else{
      if(!master||document.status==='Draft')throw accountError(409,'This GAN has no current issued package');
      issue=await loadGanIssue(db,master.issue_id);assertGanRecipient(access,issue);
      if(action==='open'){if(!['Sent','Reviewed'].includes(master.phase))throw accountError(409,'This GAN is no longer awaiting review');phase='Reviewed';evidence={firstOpen:master.phase==='Sent'};}
      if(action==='reject'){if(master.phase!=='Reviewed')throw accountError(409,'Review the issued package before rejecting it');phase='Rejected';evidence={note:request.note};}
      if(action==='sign'){
        if(master.phase!=='Reviewed')throw accountError(409,'Review the issued package before signing it');
        if(!issue.manifest.allowed_methods.includes('electronic'))throw accountError(403,'This issued template requires print, sign and upload');
        if(request.issuedPdfSha256!==issue.pdf_sha256)throw accountError(409,'The PDF being accepted does not match this issued package');
        if(ganNameKey(request.name)!==ganNameKey(issue.manifest.recipient.name))throw accountError(400,'Type the registered authorized official name printed on this GAN');
        phase='RecipientSigned';const displayDate=new Date(now).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})+' (UTC)';evidence={consentVersion:'gmt-gan-electronic-v1',name:request.name,title:request.title,actorId:actor.id,actorEmail:actor.email,signedAt:now,displayDate,displayTimezone:'UTC',ip,issueId:issue.id,eventId,issuedPdfSha256:issue.pdf_sha256,consents:GAN_SIGNATURE_CONSENTS,confirmed:{electronic:true,conditions:true,authority:true}};
        artifact=await renderGanIssuedPackage(db,issue.manifest.gan,issue.manifest.package,{recipient:{name:request.name,title:request.title,displayDate},certificate:evidence});evidence.artifact={pages:artifact.pages,parts:artifact.parts,pdf_sha256:artifact.pdf_sha256};
      }
    }
    const event=(await db.query(`INSERT INTO gan_workflow_events(id,document_id,issue_id,revision,request_id,request_sha256,action,from_phase,to_phase,actor_id,actor_role,actor_email,occurred_at,ip,evidence,evidence_sha256,pdf,pdf_sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,encode(sha256(convert_to($15::jsonb::text,'UTF8')),'hex'),$16,$17) RETURNING *`,
      [eventId,document.id,issue.id,revision,request.requestId,fingerprint,action,fromPhase,phase,actor.id,actor.role,actor.email,now,ip,JSON.stringify(evidence),artifact?.pdf||null,artifact?.pdf_sha256||null])).rows[0];
    await db.query(`INSERT INTO gan_workflows(document_id,issue_id,revision,phase,last_event_id,updated_at) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(document_id) DO UPDATE SET issue_id=EXCLUDED.issue_id,revision=EXCLUDED.revision,phase=EXCLUDED.phase,last_event_id=EXCLUDED.last_event_id,updated_at=EXCLUDED.updated_at`,[document.id,issue.id,revision,phase,event.id,now]);
    await db.query(`UPDATE generated_documents SET status=$2,sent_by=$3,sent_at=$4,signed_by=$5,signed_at=$6,subrecipient_notes=$7,updated_date=NOW() WHERE id=$1`,
      [document.id,phase==='RecipientSigned'?'Signed':phase,issue.sender_email,issue.issued_at,action==='sign'?actor.email:phase==='Verified'?evidence.recipient.email:null,action==='sign'?now:phase==='Verified'?evidence.recipient.received_at:null,['reject','return_upload'].includes(action)?request.note:null]);
    const actionName={send:'GANSent',open:'GANOpened',sign:'GANRecipientSigned',reject:'GANRejected',submit_upload:'GANSignedDocumentsSubmitted',accept_upload:'GANSignedUploadsVerified',return_upload:'GANSignedUploadsReturned'}[action];
    await auditForm(db,actor,document.id,actionName,fromPhase+' → '+phase+'; issue '+issue.id+'; event '+event.id+'; observed IP: '+ip,'GeneratedDocument');
    const delivery=await queueGanWorkflowNotices(db,event,issue,access.organization);
    await db.query('COMMIT');return {event:ganWorkflowEventProjection(event),issue:publicGanIssue(issue),phase,revision,replayed:false,fullyExecuted:false,delivery:{...delivery,providerDeliveryVerified:false}};
  }catch(error){await db.query('ROLLBACK');if(['40001','40P01','23505'].includes(error.code))throw accountError(409,'The GAN or its sources changed concurrently. Reload and retry the same request.');throw error;}finally{db.release();}
}
