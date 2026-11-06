import {createHash} from 'node:crypto';
import {accountError,validateInvite} from './accountPolicy.js';
import {accountActor} from './accountRepository.js';
import {createAccountService} from './accountService.js';
export async function previewAccountInvites(db,actorId,rows) {
  const actor=await accountActor(db,actorId);
  if(!['admin','isc_admin'].includes(actor.role))throw accountError(403,'Bulk upload is available to administrators only');
  if(!Array.isArray(rows)||!rows.length||rows.length>200)throw accountError(400,'Upload between 1 and 200 user rows');
  const organizations=(await db.query('SELECT * FROM organizations WHERE is_active IS NOT FALSE')).rows;
  const emails=new Map();
  for(const row of rows) {
    const email=String(row?.email||'').trim().toLowerCase();
    emails.set(email,(emails.get(email)||0)+1);
  }
  const results=[];
  for(const [index,row] of rows.entries()) {
    const errors=[];let data;
    try {
      if(!row||typeof row!=='object'||Array.isArray(row))throw accountError(400,'Invalid row');
      let org;
      if(row.organization_id)org=organizations.find(org=>org.id===row.organization_id);
      else if(row.organization_name) {
        const matches=organizations.filter(org=>org.name.trim().toLowerCase()===String(row.organization_name).trim().toLowerCase()&&
          (!row.scope_state||org.state?.toUpperCase()===String(row.scope_state).trim().toUpperCase()));
        if(matches.length>1)throw accountError(400,'Organization name is ambiguous. Include organization_id or state.');
        org=matches[0];
      }
      if((row.organization_id||row.organization_name)&&!org)throw accountError(400,'Organization was not found in the selected state');
      data=validateInvite(actor,{...row,full_name:row.full_name||row.name},org);
      if(emails.get(data.email)>1)errors.push('Duplicate email in this file');
      if((await db.query('SELECT id FROM users WHERE LOWER(email)=$1',[data.email])).rows.length)errors.push('An account already exists. Use Resend invite or Edit.');
    }catch(error){errors.push(error.status?error.message:'Unable to validate this row');}
    results.push({row:index+2,email:data?.email||String(row?.email||''),data,errors});
  }
  const fingerprint=createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const valid=results.filter(row=>!row.errors.length).length;
  return {rows:results,total:results.length,valid,invalid:results.length-valid,fingerprint};
}
export async function commitAccountInvites(db,sendLink,actorId,rows,fingerprint,ip) {
  const preview=await previewAccountInvites(db,actorId,rows);
  if(preview.fingerprint!==fingerprint)throw accountError(409,'The import changed. Run the dry run again before importing.');
  const service=createAccountService(db,sendLink);
  const results=[];
  for(const row of preview.rows) {
    if(row.errors.length){results.push({row:row.row,email:row.email,success:false,error:row.errors.join('; ')});continue;}
    try {
      const result=await service.invite(actorId,row.data,ip);
      results.push({row:row.row,email:row.email,success:true,user_id:result.user.id,delivery:'accepted'});
    }catch(error){results.push({row:row.row,email:row.email,success:false,
      error:error.status?error.message:'Invitation email could not be sent. No account was saved.'});}
  }
  return {total:results.length,succeeded:results.filter(row=>row.success).length,
    failed:results.filter(row=>!row.success).length,rows:results};
}
