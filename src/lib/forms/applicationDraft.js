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
export function draftPayload(form,nofo,organization) {
  const normalized={...form};
  for(const key of applicationKeys)if(['number','currency'].includes(fieldType(key)))normalized[key]=form[key]===''?0:Number(form[key]??0);
  return {...normalized,nofo_id:nofo?.id||null,organization_id:organization.id,status:'Draft',
    requested_amount:form.requested_amount===''?0:Number(form.requested_amount),
    match_amount:form.match_amount===''?0:Number(form.match_amount),
    performance_start:form.performance_start||null,performance_end:form.performance_end||null};
}
export async function persistDraft({application,form,nofo,organization,items,removedIds=[],onApplication=(_saved)=>{},onBudget=(_index,_row)=>{}}) {
  const data=draftPayload(form,nofo,organization);
  const saved=application?await base44.entities.Application.update(application.id,data):await base44.entities.Application.create(data);
  onApplication(saved);
  const budgets=[];
  for(const [index,item] of items.entries()) {
    const payload={application_id:saved.id,budget_category:item.budget_category,line_description:item.line_description,
      amount_requested:Number(item.amount_requested||0),amount_match:Number(item.amount_match||0)};
    const row=item.id&&item.isExisting?await base44.entities.ApplicationBudget.update(item.id,payload):await base44.entities.ApplicationBudget.create(payload);
    budgets.push({...row,isExisting:true});onBudget(index,{...row,isExisting:true});
  }
  for(const id of removedIds)await base44.entities.ApplicationBudget.delete(id);
  return {application:saved,items:budgets};
}
export function applyFieldValue(form,field,value) {
  if(field.source==='ehp')return {...form,ehp_screening_answers:{...form.ehp_screening_answers,[field.key]:value}};
  if(field.source==='application')return {...form,[field.key]:value};
  return {...form,form_values:{...form.form_values,[field.key]:value}};
}
export function reviewFields(definition,context,audience='edit') {
  return formFields(definition).filter(field=>fieldIsVisible(field,definition,context)&&(audience!=='export'||field.exportVisible)).map(field=>({...field,sectionLabel:definition.sections.find(section=>section.id===field.sectionId)?.label,value:fieldValue(field,context)}));
}
export {formExportCsv} from './formExports';
