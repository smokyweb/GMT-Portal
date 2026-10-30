import {accountError} from '../accountPolicy.js';
import {findAccount} from '../accountRepository.js';
import {assertGanGrantee,ganContextIssue,ganPublicPerson} from './ganContextPolicy.js';
import {eligibleRecipientOfficial,eligibleGanApprover} from './ganSettingsPolicy.js';
export async function ganConfiguredPeople(db,actor,organization,options) {
  const issues=[],add=(token,reason,record,id,field,screen)=>issues.push(ganContextIssue(token,reason,record,id,field,screen));
  const explicitOfficial=options.authorizedOfficialId!==undefined,officialId=explicitOfficial?options.authorizedOfficialId:organization.authorized_official_id;
  let authorizedOfficial=officialId?(await db.query('SELECT id,email,full_name,title,phone,role,organization_id,active_status FROM users WHERE id::text=$1',[officialId])).rows[0]:null;
  if(officialId&&!eligibleRecipientOfficial(authorizedOfficial,organization)) {
    if(explicitOfficial)throw accountError(authorizedOfficial?403:404,'Choose an active registered subrecipient official belonging to this organization');
    add('authorized_official_email','Review the saved official assignment; the account is inactive, missing or no longer assigned here','Organization',organization.id,'authorized_official_id','Organizations › Award contacts');authorizedOfficial=null;
  }
  if(!authorizedOfficial)add('authorized_official_email','Assign a registered authorized official or choose one for this draft','Organization',organization.id,'authorized_official_id','Organizations › Award contacts');
  const explicitGrantee=options.granteeId!==undefined,granteeId=explicitGrantee?options.granteeId:organization.grantee_id;
  let grantee=granteeId?(await db.query('SELECT * FROM grantees WHERE id::text=$1',[granteeId])).rows[0]:null;
  if(granteeId) {
    try{assertGanGrantee(actor,grantee,organization);}catch(error){if(explicitGrantee)throw error;add('passthrough_entity','Review the saved grantee assignment','Organization',organization.id,'grantee_id','Organizations › Award contacts');grantee=null;}
  }
  if(!grantee)add('passthrough_entity','Assign the state grantee or choose one for this draft','Organization',organization.id,'grantee_id','Organizations › Award contacts');
  let approvingOfficial={};
  if(grantee?.approving_official_id) {
    const official=await findAccount(db,grantee.approving_official_id);
    if(!eligibleGanApprover(official,grantee))add('approving_official_name','Select an active NEMA approver for this agency, or explicitly configure print-only details','Grantee',grantee.id,'approving_official_id','Admin Hub › Grantee award settings');
    else approvingOfficial={...ganPublicPerson(official),title:grantee.approving_official_title||official.title};
  }
  return {authorizedOfficial:ganPublicPerson(authorizedOfficial),grantee:grantee||{},approvingOfficial,issues};
}
