import {NOFO_AWARD_FIELDS,inputDate} from './awardFields';
export function prepareNofoAwardForm(nofo,program={}) {
  const fields=Object.fromEntries(NOFO_AWARD_FIELDS.map(field=>[field.key,field.type==='date'?inputDate(nofo[field.key]):nofo[field.key]??(field.key==='cfda_number'?program.cfda_number:field.key==='grant_year'?program.program_year:null)??'']));
  if(nofo.is_r_and_d==null)fields.is_r_and_d=null;
  return {...nofo,...fields};
}
export function nofoAwardSaveData(form) {
  const {award_metadata_revision,current_form_version_id:_formVersion,...data}=form;
  for(const key of ['open_date','close_date'])if(data[key]==='')data[key]=null;
  for(const field of NOFO_AWARD_FIELDS)if(Object.hasOwn(data,field.key)&&data[field.key]==='')data[field.key]=null;
  return {...data,...(award_metadata_revision!==undefined?{expectedAwardMetadataRevision:award_metadata_revision}:{})};
}
export function applyAwardProgramDefaults(form,program) {
  return {...form,cfda_number:form.cfda_number||program?.cfda_number||'',grant_year:form.grant_year||program?.program_year||''};
}
