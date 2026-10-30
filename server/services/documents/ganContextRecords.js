import {accountError} from '../accountPolicy.js';
import {ganConfiguredPeople} from './ganConfiguredPeople.js';
import {ganContextIssue,ganProgramCodes} from './ganContextPolicy.js';
const ownTable=async(db,name)=>Boolean((await db.query("SELECT to_regclass(current_schema()||'.'||$1) AS name",[name])).rows[0].name);
export async function ganSupportingRecords(db,actor,application,organization,nofo,options) {
  const issues=[],add=(...args)=>issues.push(ganContextIssue(...args));
  let program={};
  if(nofo.program_id) {
    program=(await db.query('SELECT * FROM grant_programs WHERE id::text=$1',[nofo.program_id])).rows[0]||{};
    if(!program.id)add('program_code','Restore the NOFO grant program assignment','Nofo',nofo.id,'program_id','NOFOs › Edit NOFO');
  } else {
    const matches=(await db.query('SELECT * FROM grant_programs WHERE code=$1 LIMIT 2',[nofo.program_code||application.program_code])).rows;
    if(matches.length===1)program=matches[0];
    else add('program_code','Assign one grant program to this NOFO; the program code is missing or ambiguous','Nofo',nofo.id,'program_id','NOFOs › Edit NOFO');
  }
  if(program.is_active===false)add('program_code','Reactivate the grant program before issuing a GAN','GrantProgram',program.id,'is_active','Grant Programs');
  let award={};
  if(await ownTable(db,'award_details'))award=(await db.query('SELECT * FROM award_details WHERE application_id=$1',[application.id])).rows[0]||{};
  if(!award.id)add('award_record','Save the award record before generating a GAN','AwardDetails',null,'id','Applications › Review › Award Details');
  let formDefinition;
  if(application.form_version_id) {
    if(await ownTable(db,'nofo_form_versions'))formDefinition=(await db.query('SELECT definition FROM nofo_form_versions WHERE id=$1 AND nofo_id::text=$2',[application.form_version_id,application.nofo_id])).rows[0]?.definition;
    if(!formDefinition)add('cost_share_requirement','Restore this application’s pinned form version','Application',application.id,'form_version_id','Applications › Review');
  }
  const budgets=(await db.query('SELECT * FROM application_budgets WHERE application_id=$1 ORDER BY created_date,id',[application.id])).rows;
  const projects=await ownTable(db,'application_projects')?(await db.query('SELECT * FROM application_projects WHERE application_id::text=$1 ORDER BY project_id,id',[application.id])).rows:[];
  const people=await ganConfiguredPeople(db,actor,organization,options);issues.push(...people.issues);
  const template=options.templateId?(await db.query('SELECT * FROM document_templates WHERE id::text=$1',[options.templateId])).rows[0]:null;
  if(options.templateId&&!template)throw accountError(404,'Document template not found');
  if(template&&(template.is_active!==true||template.doc_type!=='Grant Award Notice'))throw accountError(409,'Choose an active Grant Award Notice template');
  if(template&&(!Number.isInteger(template.version)||template.version<1))add('template_body','Save a numbered template version before preparing this award','Template',template.id,'version','Document Templates');
  if(template&&!String(template.template_body||'').trim())add('template_body','Complete the GAN template body before preparing this award','Template',template.id,'template_body','Document Templates');
  if(!template)add('template_body','Select an active Grant Award Notice template','Template',null,'template_body','Document Templates');
  return {program,award,formDefinition,budgets,projects,...people,template:template||{},programCodes:ganProgramCodes(template?.program_codes),issues};
}
