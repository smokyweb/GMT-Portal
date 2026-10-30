import {accountError} from '../accountPolicy.js';
export async function submissionMetadata(db,previous={}) {
  if(previous.application_number)return {application_number:previous.application_number,submitted_at:new Date().toISOString()};
  await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':application-number'))");
  const year=new Date().getUTCFullYear(),pattern='^APP-'+year+'-([0-9]{1,9})$';
  const count=Number((await db.query("SELECT COALESCE(MAX((regexp_match(application_number,$1))[1]::integer),0)+1 AS next FROM applications",[pattern])).rows[0].next);
  if(!Number.isSafeInteger(count))throw accountError(409,'Unable to assign an application number');
  return {application_number:'APP-'+year+'-'+String(count).padStart(5,'0'),submitted_at:new Date().toISOString()};
}
export async function notifyApplicationSubmission(db,application,organization) {
  const recipients=(await db.query(`SELECT u.email FROM users u LEFT JOIN grantees g ON g.id::text=u.grantee_id
    WHERE u.role IN ('admin','reviewer') AND COALESCE(u.active_status,'active')='active'
    AND UPPER(COALESCE(NULLIF(u.scope_state,''),g.state_code,''))=UPPER($1)`,[organization.state])).rows;
  for(const recipient of recipients)await db.query(`INSERT INTO notifications(user_email,title,message,type,entity_type,entity_id,is_read,link)
    VALUES($1,'New Application Submitted',$2,'app_submitted','Application',$3,false,'/applications')`,
    [recipient.email,organization.name+' submitted application '+application.application_number+'.',application.id]);
}
