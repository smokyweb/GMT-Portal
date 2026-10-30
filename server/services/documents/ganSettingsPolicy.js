import {accountError,normalizedState} from '../accountPolicy.js';
export const GRANTEE_GAN_FIELDS=['agency_name','contact_name','contact_title','contact_email','contact_phone','approving_official_id','approving_official_name','approving_official_title'];
export const ORG_GAN_FIELDS=['authorized_official_id','grantee_id'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ganSettingsInput(input,fields) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['expectedRevision',...fields].includes(key)))throw accountError(400,'Use only the award-contact settings fields');
  if(!Number.isInteger(input.expectedRevision)||input.expectedRevision<0)throw accountError(400,'Provide the current settings revision');
  const data={};
  for(const key of fields)if(input[key]!==undefined) {
    const raw=input[key];if(raw!==null&&typeof raw!=='string')throw accountError(400,'Enter text for '+key);
    let value=String(raw??'').trim()||null;
    if(key.endsWith('_id')){if(value&&!uuid.test(value))throw accountError(400,'Choose a valid saved '+key);value=value?.toLowerCase()||null;}
    else {
      const max=key==='contact_email'?254:key==='contact_phone'?50:240;
      if(value&&value.length>max)throw accountError(400,'The '+key+' field is too long');
      if(key==='contact_email'&&value){value=value.toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw accountError(400,'Enter a valid grantee contact email');}
    }
    data[key]=value;
  }
  return data;
}
export const activeGanUser=user=>Boolean(user&&['active',undefined,null].includes(user.active_status));
export const eligibleRecipientOfficial=(user,org)=>activeGanUser(user)&&user.role==='user'&&user.organization_id===org.id;
export const eligibleGanApprover=(user,grantee)=>activeGanUser(user)&&['admin','isc_admin'].includes(user.role)&&normalizedState(user.scope_state||user.grantee_state)===normalizedState(grantee.state_code)&&(!user.grantee_id||user.grantee_id===grantee.id);
export function ganContactPerson(user) {
  return user?Object.fromEntries(['id','full_name','email','title','phone','organization_id','active_status'].map(key=>[key,user[key]])):null;
}
