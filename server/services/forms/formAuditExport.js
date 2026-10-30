import {formFields,parseObject} from '../../../src/lib/forms/defaultForm.js';
export function applicationForFormExport(application,context) {
  if(!context.version)return {...application};
  const output={...application,form_values:context.values},allowed=new Set(context.fields.map(field=>field.id));
  const answers={...parseObject(application.ehp_screening_answers)};
  for(const field of formFields(context.version.definition)) {
    if(allowed.has(field.id))continue;
    if(field.source==='application')delete output[field.key];
    if(field.source==='ehp')delete answers[field.key];
    if(field.source==='organization'&&field.key==='name')delete output.organization_name;
  }
  output.ehp_screening_answers=JSON.stringify(answers);
  return output;
}
