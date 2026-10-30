import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
export async function writeFundingRow(db,table,id,input) {
  const columns=new Set((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",[table])).rows.map(row=>row.column_name));
  const data={...input};for(const key of ['id','created_date','updated_date'])delete data[key];
  const keys=Object.keys(data);
  if(keys.some(key=>!/^[_a-z][_a-z0-9]*$/i.test(key)||!columns.has(key)))throw accountError(400,'Unknown funding request field');
  if(!keys.length)throw accountError(400,'Provide funding request fields');
  const values=keys.map(key=>data[key]!==null&&typeof data[key]==='object'?JSON.stringify(data[key]):data[key]);
  if(id)return (await db.query('UPDATE '+table+' SET '+keys.map((key,i)=>key+'=$'+(i+2)).join(',')+',updated_date=NOW() WHERE id=$1 RETURNING *',[id,...values])).rows[0];
  return (await db.query('INSERT INTO '+table+'(id,'+keys.join(',')+') VALUES($1,'+keys.map((_,i)=>'$'+(i+2)).join(',')+') RETURNING *',[randomUUID(),...values])).rows[0];
}
export function fundingDates(input) {
  const valueOf=value=>value instanceof Date?value.toISOString().slice(0,10):value;
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  for(const key of ['period_start','period_end'])if(input[key]&&!date(valueOf(input[key])))throw accountError(400,'Enter valid funding period dates');
  if(input.period_start&&input.period_end&&valueOf(input.period_end)<valueOf(input.period_start))throw accountError(400,'Period end cannot be before period start');
}
export async function fundingNumber(db) {
  const prefix='REQ-'+new Date().getUTCFullYear()+'-';
  await db.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':funding-request-number'))");
  const rows=(await db.query('SELECT request_number FROM funding_requests WHERE request_number LIKE $1',[prefix+'%'])).rows;
  const next=1+rows.reduce((max,row)=>Math.max(max,Number(row.request_number.slice(prefix.length))||0),0);
  return prefix+String(next).padStart(5,'0');
}
