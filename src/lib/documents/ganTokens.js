import {validateBudget} from '../forms/valueValidation.js';
import {hasFixedGanAwardData} from './ganTemplateBody.js';
import {ganMoney,ganDate,ganDueDate} from './ganFormatting.js';
import {ganFinancials} from './ganFinancials.js';
import {GAN_TOKEN_DEFINITIONS,GAN_OPTIONAL_TOKENS,GAN_TOKEN_ALIASES} from './ganTokenDefinitions.js';
const tokenPattern=/\{\{\s*([^{}]+?)\s*\}\}/g;
export const ganTemplateTokens=body=>[...new Set([...String(body||'').matchAll(tokenPattern)].map(match=>match[1]))];
const empty=value=>value===undefined||value===null||value==='';
export function resolveGanTokens(body,input) {
  const {application={},award={},nofo={},program={},organization={},authorizedOfficial={},grantee={},approvingOfficial={},actor={}}=input;
  const fields=award.fields||{},issues=[],ids={Application:application.id,AwardDetails:award.id,Nofo:nofo.id,GrantProgram:program.id,Organization:organization.id,User:authorizedOfficial.id,Grantee:grantee.id,GeneratedDocument:null,ApplicationBudget:application.id,Project:application.id};
  const issue=(token,reason,record,recordId,field)=>{const definition=GAN_TOKEN_DEFINITIONS[GAN_TOKEN_ALIASES[token]||token]||{};issues.push({token,reason,source:{...definition,record:record||definition.record||'Template',id:recordId??ids[record||definition.record]??null,field:field||definition.field||token}});};
  if(/\{\{|\}\}/.test(String(body||'').replace(tokenPattern,'')))issue('template_syntax','Correct empty or unclosed template tokens','Template',null,'template_body');
  if(hasFixedGanAwardData(body))issue('federal_award_number','Replace hard-coded award years, FAIN and federal award totals with tokens before publishing this template','Template',null,'template_body');
  if(!authorizedOfficial.id)issue('authorized_official_email','Select a registered authorized official');
  if(input.programCodes?.length&&!input.programCodes.includes(program.code||application.program_code))issue('program_code','Choose a template configured for this grant program','Template',null,'program_codes');
  if(!award.id)issue('award_record','Save the award record before generating a GAN');
  if(application.status!=='Approved')issue('application_number','Approve the application before generating its GAN','Application',application.id,'status');
  if(!['Pending','Active'].includes(fields.award_status))issue('award_record','This award is not open for issuing a GAN','AwardDetails',award.id,'award_status');
  if(authorizedOfficial.active_status&&!['active'].includes(authorizedOfficial.active_status))issue('authorized_official_email','The authorized official needs an active account');
  if(authorizedOfficial.id&&authorizedOfficial.organization_id!==organization.id&&!(authorizedOfficial.organization_ids||[]).includes(organization.id))issue('authorized_official_email','Assign an authorized official belonging to this organization');
  const awardDate=input.awardDate||new Date().toISOString().slice(0,10),dueDate=input.dueDate||ganDueDate(awardDate);
  if(ganDate(dueDate)&&String(dueDate).slice(0,10)<String(awardDate).slice(0,10))issue('gan_due_date','The due date cannot precede the award date');
  const address=organization.address&&organization.city&&organization.state&&organization.zip?[organization.address,[organization.city,organization.state,organization.zip].filter(Boolean).join(', ')].join(', '):undefined;
  const matchPercent=input.formDefinition?.rules?.matchPercent??nofo.match_requirement??program.match_requirement;
  if(matchPercent!=null) {
    if(!/^\d+(\.\d{1,4})?$/.test(String(matchPercent))||Number(matchPercent)>100)issue('cost_share_requirement','Configure a valid NOFO match percentage');
    else for(const error of validateBudget({sections:[],rules:{matchPercent:Number(matchPercent)}},[],{requested_amount:fields.awarded_amount,match_amount:fields.match_amount}))issue('match_amount',error.message);
  }
  /** @type {Record<string, any>} */
  const values={
    grant_year:nofo.grant_year||program.program_year,full_grant_name:nofo.full_grant_name||program.name||nofo.program_name,federal_grant_title:nofo.program_name||program.name,
    program_code:program.code||application.program_code,program_name:program.name||application.program_name,nofo_title:nofo.title||application.nofo_title,
    organization_name:organization.name,site_name:organization.site_name||'',organization_address:address,organization_uei:organization.sam_uei,organization_tax_id:organization.ein,
    authorized_official_name:authorizedOfficial.full_name,authorized_official_title:authorizedOfficial.title,authorized_official_email:authorizedOfficial.email,authorized_official_phone:authorizedOfficial.phone,
    application_number:application.application_number,subaward_number:fields.subaward_number,state_grant_number:fields.state_grant_number,
    federal_award_number:fields.federal_award_number,federal_award_date:ganDate(fields.federal_award_date),cfda_number:fields.cfda_number,cfda_title:nofo.cfda_title||program.cfda_title,
    federal_granting_agency:program.federal_agency,total_federal_award:ganMoney(nofo.total_federal_award),federal_award_description:nofo.federal_award_description,
    total_award_amount:ganMoney(fields.awarded_amount),amount_this_action:ganMoney(fields.awarded_amount),match_amount:ganMoney(fields.match_amount),requested_amount:ganMoney(application.requested_amount),
    performance_start_date:ganDate(fields.award_start),performance_end_date:ganDate(fields.award_close),project_title:application.project_title,scope_of_work_summary:application.project_narrative||application.work_plan,
    cost_share_requirement:matchPercent==null?undefined:Number(matchPercent)===0?'No non-federal match required':String(matchPercent)+'% of total project cost must be non-federal match',
    statutory_authority:nofo.statutory_authority,payment_method:nofo.payment_method||'Reimbursement through the GMT Portal',indirect_rd_statement:nofo.indirect_rd_statement||'',
    indirect_cost_rate:nofo.indirect_cost_rate==null?undefined:String(nofo.indirect_cost_rate)+'%',is_r_and_d:typeof nofo.is_r_and_d!=='boolean'?undefined:nofo.is_r_and_d?'Yes':'No',
    passthrough_entity:grantee.agency_name||grantee.name,passthrough_contact_name:grantee.contact_name,passthrough_contact_title:grantee.contact_title,passthrough_contact_phone:grantee.contact_phone,passthrough_contact_email:grantee.contact_email,
    approving_official_name:approvingOfficial.full_name||grantee.approving_official_name,approving_official_title:approvingOfficial.title||grantee.approving_official_title,
    prepared_by:input.preparedBy||actor.full_name,award_date:ganDate(awardDate),gan_due_date:ganDate(dueDate),
  };
  const financial=ganFinancials({...input,application,award},issue);Object.assign(values,financial.values);
  for(const [key,value] of Object.entries(values))if(typeof value==='string')values[key]=value.trim();
  for(const [alias,key] of Object.entries(GAN_TOKEN_ALIASES))values[alias]=values[key];
  for(const key of ['project_id','name','poete','federal','match'])values['projects[].'+key]=financial.projects.map(project=>project[key]??'').join('\n');
  values.project_breakdown=financial.requiresProjectSchedule?'See attached Project Schedule. Federal total: '+values.total_award_amount+'; match total: '+values.match_amount:
    ['| Project ID | Project | Main POETE | Federal | Match |','|---|---|---|---:|---:|',...financial.projects.map(project=>'| '+[project.project_id,project.name,project.poete,project.federal,project.match].map(value=>String(value??'').replace(/\|/g,'\\|').replace(/\n/g,' ')).join(' | ')+' |')].join('\n');
  values.projects=financial.projects.map(project=>[project.project_id,project.name,project.poete,project.federal,project.match].join(' · ')).join('\n');
  const tokens=ganTemplateTokens(body);
  for(const token of tokens) {
    if(!Object.hasOwn(GAN_TOKEN_DEFINITIONS,token)&&!Object.hasOwn(GAN_TOKEN_ALIASES,token)){issue(token,'Unknown template token','Template',null,token);continue;}
    if(token==='federal_award_number'&&values[token]&&!/^[A-Z]{2,6}-\d{4}-[A-Z0-9]{2,6}-\d{4,8}$/.test(values[token]))issue(token,'Correct the federal award identifier');
    if(token==='cfda_number'&&values[token]&&!/^\d{2}\.\d{3}$/.test(values[token]))issue(token,'Correct the CFDA / Assistance Listing number');
    if(empty(values[token])&&!GAN_OPTIONAL_TOKENS.has(token))issue(token,'Complete this field before sending');
    if(typeof values[token]==='string'&&/\{\{|\}\}/.test(values[token]))issue(token,'Record values cannot introduce template tokens');
  }
  const merged=String(body||'').replace(tokenPattern,(match,token)=>empty(values[token])?(GAN_OPTIONAL_TOKENS.has(token)?'':match):String(values[token]));
  return {body:merged,values,tokens,issues,ready:issues.length===0,projects:financial.projects,requiresProjectSchedule:financial.requiresProjectSchedule,awardDate,dueDate};
}
