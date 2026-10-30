import {PROJECT_FIELDS,standardProgramFields,EHP_FIELDS,ORGANIZATION_FIELDS} from './standardFields.js';
export const FIELD_TYPES=['text','longtext','number','currency','date','daterange','dropdown','multiselect','checkbox','yesno','file','table'];
export function defaultForm(nofo={}) {
  const section=(id,label,kind,fields=[])=>({id,label,kind,enabled:true,fields:JSON.parse(JSON.stringify(fields))});
  const custom=(id,label,type,extra={})=>({id,key:id,label,type,source:'custom',visible:true,required:true,reviewerVisible:true,exportVisible:true,...extra});
  const program=standardProgramFields(nofo.program_code);
  if(nofo.program_code==='EMPG')program.push(
    custom('cf_empg_personnel','EMPG-funded Personnel','table',{columns:[
      {id:'name',label:'Name',type:'text',required:true},
      {id:'position',label:'Position',type:'text',required:true},
      {id:'percent_time',label:'Percent of Time Charged to EMPG',type:'number',required:true,min:0,max:100},
      {id:'nims_training',label:'NIMS Training',type:'text',required:true},
      {id:'exercise_participation',label:'Exercise Participation',type:'text',required:true},
    ]}),
    custom('cf_empg_nims','Additional NIMS Training Notes','longtext',{required:false}),
    custom('cf_empg_exercises','Additional Exercise Participation Notes','longtext',{required:false}),
  );
  const rawDocuments=nofo.required_documents||[],documents=(Array.isArray(rawDocuments)?rawDocuments:rawDocuments.name?[rawDocuments]:[]).map(doc=>typeof doc==='string'?{name:doc,mandatory:true}:{name:doc.name,mandatory:Boolean(doc.mandatory)});
  const percent=nofo.match_requirement==null?(nofo.program_code==='EMPG'?50:0):Number(nofo.match_requirement);
  return {schemaVersion:1,sections:[
    section('organization','Organization','organization',ORGANIZATION_FIELDS),
    section('project','Project Details','project',PROJECT_FIELDS),
    section('program','Program Details','program',program),
    section('ehp','EHP Screening','ehp',[...EHP_FIELDS,{id:'std_ehp_notes',key:'ehp_notes',label:'Additional EHP Notes',source:'application',type:'longtext',required:false,visible:true,reviewerVisible:true,exportVisible:true}]),
    section('budget','Budget','budget'),
    section('documents','Documents','documents'),
    section('review','Review & Submit','review'),
  ],rules:{matchPercent:percent,requiredDocuments:JSON.parse(JSON.stringify(documents)),ehpScreeningDocument:'EHP Screening Form'}};
}
export function formFields(definition) {
  return definition.sections.flatMap(section=>section.fields.map(field=>({...field,sectionId:section.id,sectionEnabled:section.enabled})));
}
export function parseObject(value,fallback={}) {
  if(value&&typeof value==='object'&&!Array.isArray(value))return value;
  try {const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:fallback;} catch{return fallback;}
}
/** @param {any} field @param {any} context */
export function fieldValue(field,context={}) {
  const {application={},organization={},values={}}=context;
  if(field.source==='organization')return organization[field.key];
  if(field.source==='ehp')return parseObject(application.ehp_screening_answers)[field.key];
  if(field.source==='application')return application[field.key];
  return values[field.key];
}
export function fieldIsVisible(field,definition,context,seen=new Set()) {
  if(field.visible===false||field.sectionEnabled===false)return false;
  if(!field.condition)return true;
  if(seen.has(field.id))return false;
  const parent=formFields(definition).find(item=>item.id===field.condition.fieldId);
  if(!parent)return false;
  const next=new Set(seen);next.add(field.id);
  if(!fieldIsVisible(parent,definition,context,next))return false;
  const value=fieldValue(parent,context),expected=field.condition.value;
  if(field.condition.operator==='equals')return String(value??'')===String(expected);
  if(field.condition.operator==='not_equals')return String(value??'')!==String(expected);
  return Array.isArray(value)&&value.map(String).includes(String(expected));
}
