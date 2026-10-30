import {randomUUID} from 'node:crypto';
import {accountError,normalizedState} from '../accountPolicy.js';
import {findAccount} from '../accountRepository.js';
const unpack=value=>{for(let i=0;i<3&&typeof value==='string';i++){try{value=JSON.parse(value);}catch{return {};}}return value&&typeof value==='object'?value:{};};
function channelsFor(rules,role) {
  const applicable=rules.filter(rule=>{const roles=unpack(rule.conditions).recipients;return !Array.isArray(roles)||roles.length===0||roles.includes(role);});
  if(!applicable.length)return {email:true,inApp:true,ruleIds:[]};
  const enabled=applicable.filter(rule=>rule.is_active!==false),deliveries=enabled.map(rule=>{const mode=unpack(rule.actions).delivery;return ['email','in_app','in-app','both'].includes(mode)?mode:'both';});
  return {email:deliveries.some(mode=>['email','both'].includes(mode)),inApp:deliveries.some(mode=>['in_app','in-app','both'].includes(mode)),ruleIds:applicable.map(rule=>rule.id)};
}
export async function queueGanWorkflowNotices(db,event,issue,organization) {
  if(event.action==='open'&&event.from_phase==='Reviewed')return {emailsQueued:0,inAppCreated:0};
  for(const table of ['notifications','workflow_rules'])if(!(await db.query('SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1',[table])).rows.length)throw accountError(500,'The owned notification tables are unavailable');
  const labels={send:'GAN Sent',open:'GAN Reviewed',sign:'GAN Signed',reject:'GAN Rejected',submit_upload:'GAN Uploaded',accept_upload:'GAN Verified',return_upload:'GAN Upload Returned'},label=labels[event.action];
  const rules=(await db.query('SELECT id,is_active,conditions,actions FROM workflow_rules WHERE trigger_event=$1 OR trigger=$1',[label])).rows;
  const recipients=['send','return_upload','accept_upload'].includes(event.action)?[issue.recipient_id,...(event.action==='accept_upload'?[issue.sender_id,...(issue.approver_id?[issue.approver_id]:[])]:[])]:[issue.sender_id,...(event.action==='sign'&&issue.approver_id?[issue.approver_id]:[])];
  const messages={send:'An award package is ready for your review and signature.',open:'The registered recipient opened the award package.',sign:'The subrecipient signed. NEMA countersignature is still required.',reject:'The subrecipient rejected the award package: '+(event.evidence.note||''),submit_upload:'Signed documents were uploaded and need NEMA verification.',accept_upload:'NEMA accepted the signed uploads. Assistant Director countersignature is still required.',return_upload:'NEMA returned the signed uploads for correction: '+(event.evidence.note||'')};
  let emailsQueued=0,inAppCreated=0;
  for(const id of [...new Set(recipients)]){
    const user=await findAccount(db,id);if(!user||!['active',null,undefined].includes(user.active_status))continue;
    const allowed=user.role==='user'?user.id===issue.recipient_id&&user.organization_id===issue.organization_id:user.role==='isc_admin'||['admin','reviewer'].includes(user.role)&&normalizedState(user.scope_state||user.grantee_state)===normalizedState(organization.state);
    if(!allowed||user.role!=='isc_admin'&&user.role!=='user'&&user.grantee_id&&user.grantee_id!==issue.manifest.gan.sources.granteeId)continue;
    const plan=channelsFor(rules,user.role),title=label+' · '+issue.manifest.gan.values.application_number,body=messages[event.action],link='/award-documents/'+issue.document_id;
    if(plan.inApp){await db.query(`INSERT INTO notifications(id,user_email,title,message,type,entity_type,entity_id,is_read,link,gan_workflow_event_id,gan_workflow_user_id)
      VALUES($1,$2,$3,$4,'Document','GeneratedDocument',$5,false,$6,$7,$8)`,[randomUUID(),user.email,title,body,issue.document_id,link,event.id,user.id]);inAppCreated++;}
    if(plan.email){await db.query(`INSERT INTO gan_workflow_delivery(id,event_id,user_id,recipient_email,subject,body,link,rule_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(),event.id,user.id,user.email,title,body,link,JSON.stringify(plan.ruleIds)]);emailsQueued++;}
  }
  return {emailsQueued,inAppCreated};
}
