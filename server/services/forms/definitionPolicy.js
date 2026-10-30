import {FIELD_TYPES,defaultForm,formFields} from '../../../src/lib/forms/defaultForm.js';
import {accountError} from '../accountPolicy.js';
const identifier=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const fail=message=>{throw accountError(400,message);};
const label=(value,name)=>{if(typeof value!=='string'||!value.trim()||value.length>250)fail(name+' must have a label of 1 to 250 characters');};
function validateField(field,ids,columns=false) {
  if(!field||!identifier.test(field.id)||ids.has(field.id))fail('Field IDs must be unique valid identifiers');
  ids.add(field.id);label(field.label,'Every field');
  if(!FIELD_TYPES.includes(field.type))fail('Unknown field type');
  if(columns&&['table','file','daterange','multiselect'].includes(field.type))fail('Choose a simple type for a repeating table column');
  if(typeof field.required!=='boolean')fail('Required must be true or false');
  for(const key of ['min','max','maxLength'])if(field[key]!=null&&!Number.isFinite(Number(field[key])))fail('Field limits must be numbers');
  if(field.min!=null&&field.max!=null&&Number(field.min)>Number(field.max))fail('Minimum cannot exceed maximum');
  if(field.maxLength!=null&&(field.maxLength<1||field.maxLength>100000))fail('Character limit must be between 1 and 100000');
  if(field.help!=null&&(typeof field.help!=='string'||field.help.length>2000))fail('Help text is too long');
  if(['dropdown','multiselect','yesno'].includes(field.type)) {
    if(!Array.isArray(field.options)||!field.options.length||field.options.length>100||
      field.options.some(value=>typeof value!=='string'||!value.trim()||value.length>250)||new Set(field.options).size!==field.options.length)fail('Provide distinct nonempty choices');
  }
  if(field.ehpTrigger!==undefined&&typeof field.ehpTrigger!=='boolean')fail('EHP trigger must be true or false');
  if(field.ehpTrigger&&!['yesno','dropdown'].includes(field.type))fail('EHP triggers need a Yes/No or dropdown field');
  if(field.type==='table') {
    if(!Array.isArray(field.columns)||!field.columns.length||field.columns.length>20)fail('Repeating tables need 1 to 20 columns');
    const columnIds=new Set();for(const column of field.columns)validateField(column,columnIds,true);
  }
}
export function validateDefinition(input,nofo) {
  if(!input||JSON.stringify(input).length>200000)fail('The form is too large');
  const definition=JSON.parse(JSON.stringify(input));
  if(definition.schemaVersion!==1||!Array.isArray(definition.sections)||!definition.sections.length||definition.sections.length>30)fail('Invalid form sections');
  if(definition.rules&&definition.rules.requiredDocuments===undefined)definition.rules.requiredDocuments=defaultForm(nofo).rules.requiredDocuments;
  const sectionIds=new Set(),fieldIds=new Set(),standards=new Map(formFields(defaultForm(nofo)).filter(field=>field.source!=='custom').map(field=>[field.id,field]));
  const kinds=['organization','project','program','ehp','budget','documents','review','custom'];
  for(const section of definition.sections) {
    if(!identifier.test(section.id)||sectionIds.has(section.id))fail('Section IDs must be unique');
    sectionIds.add(section.id);label(section.label,'Every section');
    if(!kinds.includes(section.kind)||typeof section.enabled!=='boolean'||!Array.isArray(section.fields)||section.fields.length>100)fail('Invalid section settings');
    for(const field of section.fields) {
      validateField(field,fieldIds);
      if(typeof field.visible!=='boolean'||typeof field.reviewerVisible!=='boolean'||typeof field.exportVisible!=='boolean')fail('Choose field visibility settings');
      if(field.source==='custom') {if(!field.id.startsWith('cf_')||field.key!==field.id)fail('Custom fields need a stable custom ID');}
      else {
        const standard=standards.get(field.id);
        if(!standard||field.source!==standard.source||field.key!==standard.key||field.type!==standard.type)fail('Standard field storage and type cannot change');
      }
    }
  }
  for(const id of standards.keys())if(!fieldIds.has(id))fail('Hide standard fields instead of deleting them');
  for(const kind of ['organization','budget','documents','review'])if(definition.sections.filter(section=>section.kind===kind).length!==1)fail('Keep one organization, budget, documents and review section');
  if(!definition.sections.some(section=>section.kind==='review'&&section.enabled))fail('Review & Submit must remain enabled');
  if(definition.sections.at(-1).kind!=='review')fail('Keep Review & Submit as the final section');
  const documents=definition.rules?.requiredDocuments;
  if(!Array.isArray(documents)||documents.length>100)fail('Provide no more than 100 required document entries');
  for(const doc of documents){label(doc.name,'Every document');if(typeof doc.mandatory!=='boolean')fail('Choose whether each document is required');}
  if(new Set(documents.map(doc=>doc.name)).size!==documents.length)fail('Document names must be unique');
  if(formFields(definition).length>300)fail('Use no more than 300 fields');
  const fields=formFields(definition),byId=new Map(fields.map(field=>[field.id,field]));
  const visit=(field,path)=>{
    if(!field.condition)return;
    const condition=field.condition;
    if(!byId.has(condition.fieldId)||!['equals','not_equals','includes'].includes(condition.operator)||
      !['string','number','boolean'].includes(typeof condition.value))fail('Invalid show-only-if condition');
    if(path.has(field.id))fail('Show-only-if conditions cannot form a cycle');
    const next=new Set(path);next.add(field.id);visit(byId.get(condition.fieldId),next);
  };
  fields.forEach(field=>visit(field,new Set()));
  if(!definition.rules||!Number.isFinite(Number(definition.rules.matchPercent))||definition.rules.matchPercent<0||definition.rules.matchPercent>=100)fail('Match percentage must be between 0 and less than 100');
  label(definition.rules.ehpScreeningDocument,'EHP screening document');
  return definition;
}
