import {randomUUID} from 'node:crypto';
import {ganPdfData} from './ganPdfData.mjs';
import {migrateGanDrafts} from '../../services/documents/ganDraftMigration.js';
import fs from 'node:fs';
export async function seedGanDraftDatabase(db,schema) {
  if(!/^gmt_qa_gan_(drafts|batches|settings|packages|workflow|returns)_\d+$/.test(schema)||(await db.query('SELECT current_schema() AS name')).rows[0].name!==schema)throw new Error('GAN fixtures require their own disposable schema');
  for(const table of ['users','organizations','grantees','grant_programs','nofos','applications','application_budgets','document_templates','generated_documents','audit_logs'])await db.query('CREATE TABLE '+table+' (LIKE public.'+table+' INCLUDING ALL)');
  const ids=Object.fromEntries(['admin','isc','reviewer','user','otherAdmin','otherUser','official','org','otherOrg','grantee','otherGrantee','program','nofo','app','secondApp','legacyApp','template','award','budget'].map(key=>[key,randomUUID()]));
  const save=async(table,id,values)=>{
    const columns=new Set((await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',[schema,table])).rows.map(row=>row.column_name));
    const entries=Object.entries({...values,id});
    for(const [key,value] of entries)if(!columns.has(key))await db.query('ALTER TABLE '+table+' ADD COLUMN '+key+' '+(typeof value==='boolean'?'BOOLEAN':typeof value==='number'?'NUMERIC':'TEXT'));
    await db.query('INSERT INTO '+table+'('+entries.map(([key])=>key).join(',')+') VALUES('+entries.map((_,i)=>'$'+(i+1)).join(',')+')',[...entries.map(([,value])=>value!==null&&typeof value==='object'?JSON.stringify(value):value)]);
  };
  const input=ganPdfData();
  await save('organizations',ids.org,{...input.organization,name:'QA Draft County',type:'County'});
  await save('organizations',ids.otherOrg,{name:'QA Draft Other State',type:'County',state:'IL'});
  await save('grantees',ids.grantee,{...input.grantee,name:'QA Nebraska Grantee',state_code:'NE'});
  await save('grantees',ids.otherGrantee,{name:'QA IL Grantee',state_code:'IL'});
  for(const [key,role,state,org] of [['admin','admin','NE',null],['isc','isc_admin',null,null],['reviewer','reviewer','NE',null],['user','user','NE',ids.org],['official','user','NE',ids.org],['otherAdmin','admin','IL',null],['otherUser','user','IL',ids.otherOrg]])
    await save('users',ids[key],{email:key+'@gan-draft-qa.invalid',full_name:'QA '+key,password_hash:'synthetic-not-a-login-hash',role,scope_state:state,organization_id:org,active_status:'active',title:'QA Official',phone:'402-555-0100'});
  await save('grant_programs',ids.program,input.program);
  await save('nofos',ids.nofo,{...input.nofo,program_id:ids.program,program_code:'EMPG',status:'Published',scope_states:['NE']});
  for(const [key,number] of [['app','APP-2026-00101'],['secondApp','APP-2026-00102'],['legacyApp','APP-2026-00103']])await save('applications',ids[key],{...input.application,application_number:number,nofo_id:ids.nofo,organization_id:ids.org});
  await db.query('CREATE TABLE award_details(id UUID PRIMARY KEY,application_id UUID UNIQUE,fields JSONB,revision INTEGER)');
  for(const [key,number] of [['app','001'],['secondApp','002'],['legacyApp','003']]) {
    await db.query('INSERT INTO award_details VALUES($1,$2,$3,1)',[key==='app'?ids.award:randomUUID(),ids[key],JSON.stringify({...input.award.fields,subaward_number:'NE-EMPG-2026-'+number})]);
    await save('application_budgets',key==='app'?ids.budget:randomUUID(),{application_id:ids[key],budget_category:'Equipment',poete:'Equipment',amount_requested:500,amount_match:500});
  }
  await save('document_templates',ids.template,{name:'QA saved EMPG GAN',doc_type:'Grant Award Notice',template_body:fs.readFileSync(new URL('../../templates/gan/GAN_EMPG_portal_body.md',import.meta.url),'utf8'),is_active:true,program_codes:'EMPG',version:3});
  await migrateGanDrafts(db);
  return {ids,selection:{templateId:ids.template,authorizedOfficialId:ids.official,granteeId:ids.grantee,awardDate:'2026-10-29'}};
}
