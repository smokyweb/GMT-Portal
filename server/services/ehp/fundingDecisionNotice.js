import {auditForm} from '../forms/formAccess.js';
export async function notifyFundingDecision(db,actor,previous,saved) {
  if(!previous||previous.status===saved.status)return;
  await auditForm(db,actor,saved.application_id,'FundingRequestUpdated','Funding request '+saved.request_number+': '+saved.status,'Application');
  if(saved.submitted_by)await db.query(`INSERT INTO notifications(user_email,title,message,type,entity_type,entity_id,is_read,link)
    VALUES($1,$2,$3,'fr_status','FundingRequest',$4,false,'/my-funding-requests')`,
    [saved.submitted_by,'Funding Request '+saved.status,'Your funding request '+saved.request_number+' is '+saved.status+'.',saved.id]);
}
