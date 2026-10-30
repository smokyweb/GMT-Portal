import fs from 'node:fs/promises';
import pg from 'pg';
import pool from '../db/connection.js';
import {defaultForm} from '../../src/lib/forms/defaultForm.js';
import {saveNofoForm} from '../services/forms/formVersions.js';
import {saveFormApplication} from '../services/forms/applicationFormSave.js';
const fixture=JSON.parse(await fs.readFile('../.git/gmt-account-preview.json','utf8'));
if(!/^gmt_qa_preview_[0-9]+$/.test(fixture.schema))throw new Error('Unexpected test schema');
const db=new pg.Pool({...pool.options,options:'-c search_path='+fixture.schema+',public'});
try {
  const admin=(await db.query("SELECT * FROM users WHERE email='qa-admin@gmt-qa.invalid'")).rows[0];
  const user=(await db.query("SELECT * FROM users WHERE email='qa-sub@gmt-qa.invalid'")).rows[0];
  const nofo=(await db.query("SELECT * FROM nofos WHERE title='QA FY2026 EMPG'")).rows[0];
  if(!admin||!user||!nofo)throw new Error('Preview fixtures are missing');
  const definition=defaultForm(nofo);
  const custom=(id,label,extra={})=>({id,key:id,label,type:'text',source:'custom',visible:true,required:false,reviewerVisible:true,exportVisible:true,...extra});
  definition.sections.find(section=>section.kind==='project').fields.push(
    custom('cf_preview_category','QA Project Category',{type:'dropdown',required:true,options:['Training','Equipment']}),
    custom('cf_preview_internal','QA Internal Field',{reviewerVisible:false,exportVisible:false}),
  );
  await saveNofoForm(db,admin.id,nofo.id,{definition,expectedVersionId:null,expectedRevision:0});
  let app=await saveFormApplication(db,user.id,null,{
    nofo_id:nofo.id,organization_id:user.organization_id,project_title:'QA Versioned EMPG Project',
    project_narrative:'Synthetic application for the verified PDF, CSV and copy flows.',requested_amount:100,match_amount:100,
    performance_start:'2026-10-01',performance_end:'2027-09-30',empg_work_plan_objectives:'QA work plan objectives',
    empg_match_source:'QA local funds',empg_match_description:'QA 50 percent match',
    ehp_screening_answers:Object.fromEntries(Array.from({length:10},(_,i)=>['q'+(i+1),'no'])),
    form_values:{cf_preview_category:'Training',cf_preview_internal:'QA-HIDDEN-FROM-EXPORT',
      cf_empg_personnel:[{name:'QA Planner',position:'Planner',percent_time:50,nims_training:'QA NIMS complete',exercise_participation:'QA exercise complete'}]},
  });
  await db.query("INSERT INTO application_budgets(application_id,budget_category,line_description,amount_requested,amount_match) VALUES($1,'Personnel','QA planner',100,100)",[app.id]);
  app=await saveFormApplication(db,user.id,app.id,{status:'Submitted'});
  console.log(JSON.stringify({id:app.id,nofoId:nofo.id,formVersionId:app.form_version_id,applicationNumber:app.application_number}));
}finally {await db.end();await pool.end();}
