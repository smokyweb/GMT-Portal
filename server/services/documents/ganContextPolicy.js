import {accountError,normalizedState} from '../accountPolicy.js';
import {ganDate} from '../../../src/lib/documents/ganFormatting.js';
export function ganContextOptions(input={}) {
  const allowed=['templateId','authorizedOfficialId','granteeId','awardDate','dueDate'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw accountError(400,'Select saved GAN records; record values cannot be supplied by the browser');
  for(const key of ['templateId','authorizedOfficialId','granteeId'])if(input[key]!=null&&(typeof input[key]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input[key])))throw accountError(400,'Choose a valid saved '+key);
  for(const key of ['awardDate','dueDate'])if(input[key]!=null&&(typeof input[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input[key])||!ganDate(input[key])))throw accountError(400,'Choose a valid '+key);
  return input;
}
export function ganProgramCodes(value) {
  if(value==null||value==='')return [];
  let parsed=value;
  if(typeof value==='string'&&value.trim().startsWith('[')) {
    try{parsed=JSON.parse(value);}catch{throw accountError(409,'Correct the template program assignments');}
  }
  const codes=Array.isArray(parsed)?parsed:typeof parsed==='string'?parsed.split(','):null;
  if(!codes||codes.some(code=>typeof code!=='string'||!code.trim()))throw accountError(409,'Correct the template program assignments');
  return [...new Set(codes.map(code=>code.trim()))];
}
export function assertGanGrantee(actor,grantee,organization) {
  if(!grantee||grantee.is_active===false||normalizedState(grantee.state_code)!==normalizedState(organization.state))throw accountError(403,'Choose an active grantee assigned to this organization state');
  if(actor.role!=='isc_admin'&&actor.grantee_id&&actor.grantee_id!==grantee.id)throw accountError(403,'Choose your assigned grantee');
}
export const ganPublicPerson=person=>person?Object.fromEntries(['id','email','full_name','title','phone','organization_id','active_status'].map(key=>[key,person[key]])):{};
export function ganContextIssue(token,reason,record,id,field,screen) {
  return {token,reason,source:{record,id:id||null,field,screen}};
}
