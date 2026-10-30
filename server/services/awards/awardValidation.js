import {accountError} from '../accountPolicy.js';
import {moneyCents} from '../forms/valueValidation.js';
import {AWARD_FIELDS,NOFO_AWARD_FIELDS,AWARD_STATUSES,inputDate} from '../../../src/lib/awards/awardFields.js';
const fain=/^[A-Z]{2,6}-\d{4}-[A-Z0-9]{2,6}-\d{4,8}$/;
export function validDate(value) {
  const text=inputDate(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(Date.parse(text))&&new Date(text).toISOString().slice(0,10)===text;
}
export function normalizeAwardValue(field,value) {
  if(value===''||value===null||value===undefined)return null;
  if(field.type==='date'){if(!validDate(value))throw accountError(400,field.label+' needs a valid date');return inputDate(value);}
  if(field.type==='money'){const cents=moneyCents(value);if(cents===null)throw accountError(400,field.label+' needs a nonnegative amount with at most two decimals');return (cents/100).toFixed(2);}
  if(field.type==='boolean'){if(typeof value!=='boolean')throw accountError(400,field.label+' must be yes or no');return value;}
  if(field.type==='percent'){if(!/^\d+(\.\d{1,4})?$/.test(String(value))||Number(value)>100)throw accountError(400,field.label+' must be between 0 and 100');return Number(value);}
  if(field.type==='year'){if(!/^\d{4}$/.test(String(value))||Number(value)<1900||Number(value)>2200)throw accountError(400,'Enter a four-digit grant year');return Number(value);}
  if(typeof value!=='string'||value.trim().length>(field.type==='textarea'?10000:500))throw accountError(400,field.label+' is too long or invalid');
  return value.trim()||null;
}
export function validateIdentifier(key,value) {
  if(!value)return;
  if(['grant_number','federal_award_number'].includes(key)&&!fain.test(value))throw accountError(400,'FAIN must use the agency-year-program-number format, for example EMK-2026-EP-05006');
  if(key.startsWith('cfda_number')&&!/^\d{2}\.\d{3}$/.test(value))throw accountError(400,'CFDA / Assistance Listing must use the format 97.042');
}
export function validateDates(fields) {
  for(const [start,end,label] of [['award_start','award_close','Award'],['federal_performance_start','federal_performance_end','Federal period of performance'],['federal_award_date','federal_close_date','Federal award'],['state_start','state_close','State']])
    if(fields[start]&&fields[end]&&inputDate(fields[end])<=inputDate(fields[start]))throw accountError(400,label+' end must be after its start');
}
export function validateAwardChanges(previous,input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw accountError(400,'Provide award fields');
  const allowed=new Map(AWARD_FIELDS.map(field=>[field.key,field])),changes={};
  for(const [key,value] of Object.entries(input)) {
    if(!allowed.has(key))throw accountError(400,'Unknown award field: '+key);
    if(String(value??'')===String(previous[key]??''))continue;
    const normalized=normalizeAwardValue(allowed.get(key),value);validateIdentifier(key,normalized);
    if(key==='award_status'&&!AWARD_STATUSES.includes(normalized))throw accountError(400,'Choose a valid award status');
    changes[key]=normalized;
  }const combined={...previous,...changes};validateDates(combined);
  if(combined.ma_amount!=null&&combined.awarded_amount!=null&&moneyCents(combined.ma_amount)>moneyCents(combined.awarded_amount))throw accountError(400,'Management & Administration amount cannot exceed the award amount');
  return changes;
}
export function normalizeNofoAwards(input,previous={},program={}) {
  const data={...input};
  for(const key of ['open_date','close_date'])if(Object.hasOwn(data,key))data[key]=normalizeAwardValue({key,label:key==='open_date'?'Open Date':'Close Date',type:'date'},data[key]);
  for(const field of NOFO_AWARD_FIELDS)if(Object.hasOwn(data,field.key))data[field.key]=normalizeAwardValue(field,data[field.key]);
  for(const key of ['grant_number','cfda_number'])if(Object.hasOwn(data,key)&&String(data[key]??'')!==String(previous[key]??''))validateIdentifier(key,data[key]);
  const combined={...previous,...data};validateDates(combined);
  if(combined.ma_percent!=null&&combined.ma_percent!=='') {
    if(program.ma_limit_percent==null)throw accountError(400,'Configure the program M&A limit before entering the retained percentage');
    if(Number(combined.ma_percent)>Number(program.ma_limit_percent))throw accountError(400,'M&A retained percentage exceeds the configured program limit of '+program.ma_limit_percent+'%');
  }return data;
}
