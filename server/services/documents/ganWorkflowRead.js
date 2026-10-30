import {readGanReturnState} from './ganReturnRead.js';
import {accountError} from '../accountPolicy.js';
import {ganWorkflowAccess,assertGanRecipient} from './ganWorkflowAccess.js';
import {loadGanIssue,verifyGanWorkflowEvent,ganWorkflowEventProjection} from './ganWorkflowIntegrity.js';
import {GAN_SIGNATURE_CONSENTS,publicGanIssue} from './ganWorkflowPolicy.js';
export async function readGanWorkflow(db,actorId,documentId) {
  const access=await ganWorkflowAccess(db,actorId,documentId),{actor,document}=access,admin=['admin','isc_admin'].includes(actor.role);
  const master=(await db.query('SELECT * FROM gan_workflows WHERE document_id=$1',[document.id])).rows[0];
  const issues=(await db.query('SELECT id,recipient_id FROM gan_workflow_issues WHERE document_id=$1 ORDER BY issued_at DESC,id',[document.id])).rows.filter(issue=>actor.role!=='user'||issue.recipient_id===actor.id);
  if(actor.role==='user'&&!issues.length)throw accountError(403,'This GAN has not been issued to you');
  if(!admin&&actor.role!=='user'&&!master)throw accountError(403,'This GAN draft has not been issued');
  const selected=actor.role==='user'?issues[0]?.id:document.status==='Draft'?null:master?.issue_id;
  const issue=selected?await loadGanIssue(db,selected):null;if(actor.role==='user'&&issue)assertGanRecipient(access,issue);
  const rows=(await db.query("SELECT id,issue_id,revision,action,from_phase,to_phase,actor_id,actor_email,occurred_at,evidence,evidence_sha256,pdf_sha256,encode(sha256(convert_to(evidence::text,'UTF8')),'hex') AS calculated_evidence_sha256 FROM gan_workflow_events WHERE document_id=$1"+(actor.role==='user'?' AND issue_id=ANY($2::uuid[])':'')+' ORDER BY revision DESC',[document.id,...(actor.role==='user'?[issues.map(i=>i.id)]:[])])).rows;
  rows.forEach(verifyGanWorkflowEvent);const phase=issue?rows.find(row=>row.issue_id===issue.id)?.to_phase||'Sent':'Draft';
  return {document:{id:document.id,application_number:document.application_number,organization_id:document.organization_id,nofo_id:access.application.nofo_id,gan_revision:document.gan_revision},phase,revision:master?.revision||0,
    issue:issue?publicGanIssue(issue):null,manifest:issue?{values:issue.manifest.gan.values,projects:issue.manifest.gan.projects,parts:issue.manifest.parts}:null,
    returns:await readGanReturnState(db,access,issue,master),events:rows.map(ganWorkflowEventProjection),canAct:actor.role==='user'&&master?.issue_id===issue?.id&&['Sent','Reviewed','UploadReturned'].includes(master?.phase),
    consentVersion:'gmt-gan-electronic-v1',consents:GAN_SIGNATURE_CONSENTS,fullyExecuted:false};
}
export async function readGanIssuePdf(db,actorId,issueId) {
  const reference=(await db.query('SELECT id,document_id,recipient_id,organization_id FROM gan_workflow_issues WHERE id::text=$1',[issueId])).rows[0];if(!reference)throw accountError(404,'Issued GAN not found');
  const access=await ganWorkflowAccess(db,actorId,reference.document_id);
  if(access.actor.role==='user')assertGanRecipient(access,reference);
  else if(!['admin','isc_admin','reviewer'].includes(access.actor.role))throw accountError(403,'This issued GAN is outside your access');
  const issue=await loadGanIssue(db,issueId);
  const artifact=(await db.query("SELECT *,encode(sha256(convert_to(evidence::text,'UTF8')),'hex') AS calculated_evidence_sha256 FROM gan_workflow_events WHERE issue_id=$1 AND action='sign' ORDER BY revision DESC LIMIT 1",[issue.id])).rows[0];
  if(artifact)verifyGanWorkflowEvent(artifact);
  return {...access,issue,pdf:artifact?.pdf||issue.pdf,pdf_sha256:artifact?.pdf_sha256||issue.pdf_sha256,stage:artifact?'RecipientSigned':'Issued',fullyExecuted:false};
}
