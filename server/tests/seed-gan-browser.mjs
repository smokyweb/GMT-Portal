import fs from 'node:fs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import live from '../db/connection.js';
import {ensureAwardSnapshot} from '../services/awards/awardRepository.js';
import {transaction} from '../services/accountRepository.js';
const meta=JSON.parse(fs.readFileSync('../.git/gmt-account-preview.json','utf8'));
if(!/^gmt_qa_preview_\d+$/.test(meta.schema))throw new Error('GAN browser fixture requires an isolated preview schema');
const db=new pg.Pool({...live.options,options:'-c search_path='+meta.schema+',public'});
try {
  if((await db.query('SELECT current_schema() AS name')).rows[0].name!==meta.schema)throw new Error('Unexpected GAN preview schema');
  const nofo=(await db.query("SELECT * FROM nofos WHERE title='QA FY2026 EMPG'")).rows[0];
  const org=(await db.query('SELECT * FROM organizations WHERE id=$1',[meta.organization])).rows[0];
  const official=(await db.query("SELECT * FROM users WHERE email='qa-sub@gmt-qa.invalid'")).rows[0];
  const actor=(await db.query("SELECT * FROM users WHERE email='qa-state-admin@gmt-qa.invalid'")).rows[0];
  const grantee=(await db.query("SELECT * FROM grantees WHERE state_code='NE'")).rows[0];
  if((await db.query("SELECT id FROM applications WHERE application_number LIKE 'APP-2026-0090%'")).rows.length)throw new Error('Use a fresh isolated preview before seeding GAN browser cases');
  await db.query('ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS poete TEXT');
  for(const field of ['contact_title','approving_official_name','approving_official_title'])await db.query('ALTER TABLE grantees ADD COLUMN IF NOT EXISTS '+field+' TEXT');
  await db.query("UPDATE grant_programs SET name='Emergency Management Performance Grant',cfda_number='97.042',federal_agency='U.S. Department of Homeland Security / FEMA',program_year=2026 WHERE id::text=$1",[nofo.program_id]);
  await db.query("UPDATE organizations SET address='100 QA Road',city='Lincoln',zip='68508',ein='12-3456789',sam_uei='QA1234567890' WHERE id=$1",[org.id]);
  await db.query("UPDATE users SET title='Emergency Manager',phone='402-555-0100' WHERE id=$1",[official.id]);
  await transaction(db,async client=>{
    await client.query("SELECT set_config('gmt.gan_settings_action','grantee',true)");
    await client.query("UPDATE grantees SET agency_name='Nebraska Emergency Management Agency',contact_name='QA Grant Coordinator',contact_title='Grant Coordinator',contact_email='grants@gan-browser-qa.invalid',contact_phone='402-555-0200',approving_official_name='QA Assistant Director',approving_official_title='Assistant Director' WHERE id=$1",[grantee.id]);
  });
  await db.query("UPDATE nofos SET grant_number='EMK-2026-EP-05006',state_grant_number='NE-EMPG-2026',program_name='Emergency Management Performance Grant',grant_year=2026,cfda_number='97.042',cfda_title='Emergency Management Performance Grants',total_federal_award=1000000,federal_award_date='2026-08-01',statutory_authority='Section 662, Post-Katrina Emergency Management Reform Act',federal_award_description='Support all-hazards preparedness and response capabilities.',indirect_cost_rate=0,is_r_and_d=false,match_requirement=50 WHERE id=$1",[nofo.id]);
  const cases=[];
  for(const [index,kind] of ['ready','budget','missing'].entries()) {
    const id=randomUUID(),number='APP-2026-0090'+(index+1);
    await db.query("INSERT INTO applications(id,nofo_id,organization_id,organization_name,application_number,project_title,project_narrative,status,program_code,program_name,requested_amount,awarded_amount,match_amount,total_expended,performance_start,performance_end) VALUES($1,$2,$3,$4,$5,$6,'Replace aging radios and train emergency personnel.','Approved','EMPG','Emergency Management Performance Grant',500,500,500,0,'2026-10-01','2027-09-30')",[id,nofo.id,org.id,org.name,number,'QA communications '+kind]);
    await db.query("INSERT INTO application_budgets(application_id,budget_category,line_description,poete,amount_requested,amount_match) VALUES($1,'Equipment','QA radio purchase','Equipment',$2,500)",[id,kind==='budget'?499:500]);
    await transaction(db,async client=>{
      const app=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0],award=await ensureAwardSnapshot(client,app,actor);
      const fields={...award.fields,subaward_number:'NE-EMPG-2026-QA'+(index+1),...(kind==='missing'?{federal_award_number:null}:{})};
      await client.query('UPDATE award_details SET fields=$2 WHERE id=$1',[award.id,JSON.stringify(fields)]);
    });
    cases.push({id,number,kind});
  }
  const templateId=randomUUID();
  await db.query("INSERT INTO document_templates(id,name,doc_type,template_body,is_active,program_codes,version) VALUES($1,'QA EMPG Grant Award Notice','Grant Award Notice',$2,true,'EMPG',3)",[templateId,fs.readFileSync('templates/gan/GAN_EMPG_portal_body.md','utf8')]);
  const data={schema:meta.schema,port:meta.port,nofoId:nofo.id,organizationId:org.id,officialId:official.id,granteeId:grantee.id,templateId,cases};
  fs.writeFileSync('../.git/gmt-gan-browser-fixture.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));
}finally{await db.end();await live.end();}
