import {applyAwardProgramDefaults} from './nofoAwardData.js';

export function prepareNofoProgramSelection(form,programs,value) {
  const program=programs.find(item=>item.id===value);
  const requirements=Array.isArray(program?.eligibility_requirements)
    ?program.eligibility_requirements.join('\n'):'';
  return {
    ...applyAwardProgramDefaults(form,program),
    program_id:value==='__none__'?'':value,
    program_name:program?.name||'',
    program_code:program?.code||'',
    eligibility_criteria:form.eligibility_criteria||program?.eligibility_criteria||requirements||'',
    allowable_costs:form.allowable_costs||program?.allowable_costs||'',
  };
}
