import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {ganContextOptions} from './ganContextPolicy.js';
import {ganDueDate} from '../../../src/lib/documents/ganFormatting.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function ganBatchRequest(input) {
  const allowed=['requestId','nofoId','templateId','granteeId','officialsByOrganization','awardDate','dueDate','applicationIds'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw accountError(400,'Choose saved GAN batch records, not record values');
  for(const key of ['requestId','nofoId','templateId'])if(!uuid(input[key]))throw accountError(400,'Choose a valid '+key);
  if(input.granteeId!=null&&!uuid(input.granteeId))throw accountError(400,'Choose a valid granteeId');
  const map=input.officialsByOrganization||{};
  if(!map||typeof map!=='object'||Array.isArray(map)||Object.entries(map).length>5000||Object.entries(map).some(([key,value])=>!uuid(key)||(value!==null&&!uuid(value))))throw accountError(400,'Map recipient organizations to registered authorized officials');
  if(input.applicationIds!==undefined&&(!Array.isArray(input.applicationIds)||!input.applicationIds.length||input.applicationIds.length>5000||input.applicationIds.some(id=>!uuid(id))))throw accountError(400,'Select one through 5000 application IDs');
  ganContextOptions({templateId:input.templateId,granteeId:input.granteeId,...(input.awardDate!==undefined?{awardDate:input.awardDate}:{}),...(input.dueDate!==undefined?{dueDate:input.dueDate}:{})});
  const normalized={...input,requestId:input.requestId.toLowerCase(),nofoId:input.nofoId.toLowerCase(),templateId:input.templateId.toLowerCase(),granteeId:input.granteeId?.toLowerCase(),
    officialsByOrganization:Object.fromEntries(Object.entries(map).map(([id,user])=>[id.toLowerCase(),user?.toLowerCase()??null]).sort(([a],[b])=>a.localeCompare(b)))};
  if(input.applicationIds)normalized.applicationIds=[...new Set(input.applicationIds.map(id=>id.toLowerCase()))].sort();
  const awardDate=input.awardDate||new Date().toISOString().slice(0,10),dueDate=input.dueDate||ganDueDate(awardDate);
  if(dueDate<awardDate)throw accountError(400,'The due date cannot precede the award date');
  return {input:normalized,selection:{templateId:normalized.templateId,granteeId:normalized.granteeId,officialsByOrganization:normalized.officialsByOrganization,awardDate,dueDate}};
}
export function ganBatchRequestHash(actorId,input) {
  const ordered=Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify({actorId,input:ordered})).digest('hex');
}
export function ganBatchRunOptions(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['limit','retryBlocked','retryRequestId'].includes(key))||
    input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>25)||input.retryBlocked!==undefined&&typeof input.retryBlocked!=='boolean')throw accountError(400,'Run up to 25 rows and choose whether to retry blocked rows');
  if(input.retryBlocked&&!uuid(input.retryRequestId)||!input.retryBlocked&&input.retryRequestId!==undefined)throw accountError(400,'Provide a new retry request ID only when retrying blocked rows');
  return {limit:input.limit??10,retryBlocked:input.retryBlocked??false,retryRequestId:input.retryRequestId?.toLowerCase()};
}
