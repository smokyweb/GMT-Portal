export {readableValue} from './formPresentation';
import {base44} from '@/api/base44Client';
import {defaultForm,formFields,parseObject,fieldValue,fieldIsVisible} from './defaultForm';
import {moneyCents} from './valueValidation';
const applicationKeys=[...new Set(['SHSP','EMPG','SLCGP','NSGP','EOC'].flatMap(program_code=>formFields(defaultForm({program_code})).filter(field=>field.source==='application').map(field=>field.key)))];
const typedFields=formFields(defaultForm({program_code:'SHSP'})).concat(...['EMPG','SLCGP','NSGP','EOC'].map(program_code=>formFields(defaultForm({program_code}))));
const fieldType=key=>typedFields.find(field=>field.source==='application'&&field.key===key)?.type;
export function draftForm(application={}) {
  return {...Object.fromEntries(applicationKeys.map(key=>[key,application[key]??(['number','currency'].includes(fieldType(key))?0:fieldType(key)==='checkbox'?false:'')])),
    ehp_screening_answers:parseObject(application.ehp_screening_answers),ehp_notes:application.ehp_notes||'',
    form_values:parseObject(application.form_values)};
}
export function budgetTotals(items) {
  return items.reduce((total,item)=>({federal:total.federal+(moneyCents(item.amount_requested)||0),match:total.match+(moneyCents(item.amount_match)||0)}),{federal:0,match:0});
}
export function draftPayload(form,nofo,organization,application=null) {
  const normalized={...form};
  for(const key of applicationKeys)if(['number','currency'].includes(fieldType(key)))normalized[key]=form[key]===''?0:Number(form[key]??0);
  const changingDraftNofo=Boolean(application?.status==='Draft'&&application.nofo_id&&nofo?.id&&application.nofo_id!==nofo.id);
  return {...normalized,nofo_id:nofo?.id||null,organization_id:organization.id,status:'Draft',...(changingDraftNofo?{form_values:{},form_version_id:null}:{}),
    requested_amount:form.requested_amount===''?0:Number(form.requested_amount),
    match_amount:form.match_amount===''?0:Number(form.match_amount),
    performance_start:form.performance_start||null,performance_end:form.performance_end||null};
}
const projectFields=['legacy_project_id','title','project_narrative','work_plan','project_type','funding_type','ij_title','ij_funding_priority','ij_number','ij_core_capability','national_priority_area','letpa_eligible','shareable','deployable','is_active','project_zip','awarded_amount'];
export async function persistDraft({application,form,nofo,organization,projects=[],removedProjectIds=[],onApplication=(_saved)=>{},onProject=(_index,_row)=>{}}) {
  const data=draftPayload(form,nofo,organization,application);
  const saved=application?await base44.entities.Application.update(application.id,data):await base44.entities.Application.create(data);
  onApplication(saved);
  const savedProjects=[];
  for(const [index,project] of projects.entries()) {
    const projectPayload=Object.fromEntries(projectFields.filter(key=>Object.prototype.hasOwnProperty.call(project,key)).map(key=>[key,project[key]]));
    Object.assign(projectPayload,{application_id:saved.id,awarded_amount:project.awarded_amount===''?null:Number(project.awarded_amount??0)});
    const row=project.id&&project.isExisting?await base44.entities.Project.update(project.id,projectPayload):await base44.entities.Project.create(projectPayload);
    const budgets=[];
    for(const item of project.budgets||[]) {
      const payload={application_id:saved.id,project_id:row.id,budget_category:item.budget_category,line_description:item.line_description,
        amount_requested:Number(item.amount_requested||0),amount_match:Number(item.amount_match||0)};
      const budget=item.id&&item.isExisting?await base44.entities.ApplicationBudget.update(item.id,payload):await base44.entities.ApplicationBudget.create(payload);
      budgets.push({...budget,isExisting:true});
    }
    savedProjects.push({...row,isExisting:true,budgets});onProject(index,{...row,isExisting:true,budgets});
  }
  for(const id of removedProjectIds)await base44.entities.Project.delete(id);
  return {application:saved,projects:savedProjects};
}
export function allProjectBudgets(projects=[]){return projects.flatMap(project=>project.budgets||[])}
export function projectTotals(project){return budgetTotals(project?.budgets||[])}
export function applyFieldValue(form,field,value) {
  if(field.source==='ehp')return {...form,ehp_screening_answers:{...form.ehp_screening_answers,[field.key]:value}};
  if(field.source==='application')return {...form,[field.key]:value};
  return {...form,form_values:{...form.form_values,[field.key]:value}};
}
export function reviewFields(definition,context,audience='edit') {
  return formFields(definition).filter(field=>fieldIsVisible(field,definition,context)&&(audience!=='export'||field.exportVisible)).map(field=>({...field,sectionLabel:definition.sections.find(section=>section.id===field.sectionId)?.label,value:fieldValue(field,context)}));
}
export {formExportCsv} from './formExports';
