import {formFields,fieldValue,fieldIsVisible} from './defaultForm.js';
const empty=value=>value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length);
export function moneyCents(value) {
  if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(String(value??'')))return null;
  const [whole,fraction='']=String(value).split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(cents)?cents:null;
}
export function fileReference(value) {
  const url=typeof value==='string'?value:value?.url;
  return typeof url==='string'&&/^\/(?:uploads|api\/files)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(url);
}
function validateValue(field,value) {
  if(empty(value))return field.required?'is required':null;
  if(['number','currency'].includes(field.type)) {
    const number=Number(value);
    if(!['number','string'].includes(typeof value)||!Number.isFinite(number)||(field.type==='currency'&&moneyCents(value)===null))return 'must be a valid '+(field.type==='currency'?'nonnegative amount with at most two decimals':'number');
    if(field.min!=null&&number<Number(field.min))return 'must be at least '+field.min;
    if(field.max!=null&&number>Number(field.max))return 'must be at most '+field.max;
  } else if(field.type==='checkbox') {
    if(typeof value!=='boolean')return 'must be checked or unchecked';
    if(field.required&&!value)return 'must be checked';
  } else if(['dropdown','yesno'].includes(field.type)) {
    if(!field.options.includes(value))return 'has an invalid choice';
  } else if(field.type==='multiselect') {
    if(!Array.isArray(value)||new Set(value).size!==value.length||value.some(item=>!field.options.includes(item)))return 'has invalid choices';
  } else if(field.type==='date'||field.type==='daterange') {
    const valid=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
    if(field.type==='date'&&!valid(value instanceof Date?value.toISOString().slice(0,10):typeof value==='string'?value.slice(0,10):value))return 'must be a valid date';
    if(field.type==='daterange'&&(!value||!valid(value.start)||!valid(value.end)||value.start>value.end))return 'must have a valid start and end date in order';
  } else if(field.type==='file') {
    if(!fileReference(value))return 'must reference an uploaded file';
  } else if(field.type==='table') {
    if(!Array.isArray(value)||value.length>200)return 'must contain no more than 200 rows';
    for(const [index,row] of value.entries()) {
      if(!row||typeof row!=='object'||Array.isArray(row))return 'has an invalid row';
      for(const column of field.columns) {const error=validateValue(column,row[column.id]);if(error)return 'row '+(index+1)+': '+column.label+' '+error;}
    }
  } else if(typeof value!=='string'||value.length>(field.maxLength||100000))return 'must be text within the character limit';
  return null;
}
export function validateFormValues(definition,context) {
  const errors=[];
  for(const field of formFields(definition)) {
    if(!fieldIsVisible(field,definition,context))continue;
    const message=validateValue(field,fieldValue(field,context));
    if(message)errors.push({fieldId:field.id,sectionId:field.sectionId,label:field.label,message:field.label+' '+message});
  }
  const app=context.application||{};
  if(app.performance_start&&app.performance_end&&app.performance_start>app.performance_end)errors.push({fieldId:'std_performance_end',sectionId:'project',message:'Performance end must not precede performance start'});
  return errors;
}
export function ehpRequired(definition,context) {
  return formFields(definition).some(field=>field.ehpTrigger&&fieldIsVisible(field,definition,context)&&
    ['yes','unknown','unsure'].includes(String(fieldValue(field,context)).toLowerCase()));
}
function percentageRatio(value) {
  const [mantissa,exponent='0']=String(value).toLowerCase().split('e'),[whole,fraction='']=mantissa.split('.');
  let numerator=BigInt(whole+fraction),denominator=10n**BigInt(fraction.length);
  const shift=Number(exponent);if(shift<0)denominator*=10n**BigInt(-shift);else numerator*=10n**BigInt(shift);
  return {numerator,denominator};
}
export function validateBudget(definition,items,application={}) {
  const errors=[],enabled=definition.sections.some(section=>section.kind==='budget'&&section.enabled);
  if(!enabled) {
    const federal=moneyCents(application.requested_amount),match=moneyCents(application.match_amount),sectionId=formFields(definition).find(field=>field.key==='requested_amount')?.sectionId||'project';
    if(federal===null||match===null||federal<=0)return [{sectionId,message:'Enter a positive federal share and a nonnegative match amount'}];
    const percent=Number(definition.rules.matchPercent),ratio=percentageRatio(percent);
    return BigInt(match)*100n*ratio.denominator<(BigInt(federal)+BigInt(match))*ratio.numerator?[{sectionId,message:'Match must be at least '+percent+'% of total project cost'}]:[];
  }
  if(!items.length)return [{sectionId:'budget',message:'Add at least one budget line'}];
  let federal=0,match=0;
  for(const [index,item] of items.entries()) {
    const f=moneyCents(item.amount_requested),m=moneyCents(item.amount_match??0);
    if(f===null||m===null)errors.push({sectionId:'budget',message:'Budget line '+(index+1)+' needs nonnegative federal and match amounts with at most two decimals'});
    else {federal+=f;match+=m;}
    if(!String(item.line_description||'').trim())errors.push({sectionId:'budget',message:'Budget line '+(index+1)+' needs a description'});
  }
  if(!Number.isSafeInteger(federal)||!Number.isSafeInteger(match))return [{sectionId:'budget',message:'Budget total exceeds the supported amount'}];
  if(federal<=0)errors.push({sectionId:'budget',message:'Federal share must be greater than zero'});
  if(moneyCents(application.requested_amount)!==federal||moneyCents(application.match_amount)!==match)errors.push({sectionId:'budget',message:'Application totals must equal the federal and match line totals'});
  const percent=Number(definition.rules.matchPercent);
  const ratio=percentageRatio(percent);
  if(BigInt(match)*100n*ratio.denominator<(BigInt(federal)+BigInt(match))*ratio.numerator)errors.push({sectionId:'budget',message:'Match must be at least '+percent+'% of total project cost'});
  return errors;
}
export function valuesForAudience(definition,context,audience='reviewer') {
  const setting=audience==='export'?'exportVisible':audience==='edit'?null:'reviewerVisible';
  return formFields(definition).filter(field=>(!setting||field[setting]!==false)&&fieldIsVisible(field,definition,context)).map(field=>({
    id:field.id,sectionId:field.sectionId,sectionLabel:definition.sections.find(section=>section.id===field.sectionId)?.label,label:field.label,type:field.type,columns:field.columns,optionLabels:field.optionLabels,value:fieldValue(field,context)??null,
  }));
}
