import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultForm,formFields} from '../../src/lib/forms/defaultForm.js';
import {importSection,newCustomField} from '../../src/lib/forms/formEditing.js';
import {validateDefinition} from '../services/forms/definitionPolicy.js';
test('Cross-program section copies convert foreign standard fields and retain hidden target standards',()=>{
  const target=defaultForm({program_code:'EMPG'}),source=defaultForm({program_code:'SHSP'}).sections.find(section=>section.kind==='program');
  const copied=importSection(target,source,'program'),fields=copied.sections.find(section=>section.id==='program').fields;
  assert.ok(fields.some(field=>field.copied_from_field_id==='std_ij_title'&&field.source==='custom'&&field.key===field.id));
  assert.equal(fields.find(field=>field.id==='std_empg_work_plan_objectives').visible,false);
  assert.doesNotThrow(()=>validateDefinition(copied,{program_code:'EMPG'}));
  assert.equal(target.sections.find(section=>section.id==='program').fields.find(field=>field.id==='std_empg_work_plan_objectives').visible,true);
});
test('Copied custom field collisions are remapped along with their conditions',()=>{
  const target=defaultForm({program_code:'EMPG'}),source=defaultForm({program_code:'EMPG'}).sections.find(section=>section.kind==='project');
  const parent=newCustomField(),child=newCustomField();child.condition={fieldId:parent.id,operator:'equals',value:'yes'};
  source.fields.push(parent,child);target.sections.find(section=>section.kind==='budget').fields.push({...parent});
  const copied=importSection(target,source,'project'),fields=copied.sections.find(section=>section.id==='project').fields;
  const mapped=fields.find(field=>field.copied_from_field_id===parent.id);
  assert.notEqual(mapped.id,parent.id);assert.equal(fields.find(field=>field.id===child.id).condition.fieldId,mapped.id);
  assert.doesNotThrow(()=>validateDefinition(copied,{program_code:'EMPG'}));
});
test('A section copy cannot silently strand conditions on removed target fields',()=>{
  const target=defaultForm({program_code:'EMPG'}),field=newCustomField(),dependent=newCustomField();
  target.sections.find(section=>section.kind==='project').fields.push(field);dependent.condition={fieldId:field.id,operator:'equals',value:'yes'};
  target.sections.find(section=>section.kind==='budget').fields.push(dependent);
  const source=defaultForm({program_code:'EMPG'}).sections.find(section=>section.kind==='project');
  assert.throws(()=>importSection(target,source,'project'),/conditions that refer to replaced/);
});
test('A later section can resolve conditions against a previously converted program field',()=>{
  const target=defaultForm({program_code:'EMPG'}),source=defaultForm({program_code:'SHSP'});
  const withProgram=importSection(target,source.sections.find(section=>section.kind==='program'),'program');
  const field=newCustomField();field.condition={fieldId:'std_ij_title',operator:'equals',value:'QA'};
  source.sections.find(section=>section.kind==='project').fields.push(field);
  const copied=importSection(withProgram,source.sections.find(section=>section.kind==='project'),'project');
  const parent=formFields(copied).find(item=>item.copied_from_field_id==='std_ij_title');
  assert.equal(formFields(copied).find(item=>item.id===field.id).condition.fieldId,parent.id);
  assert.doesNotThrow(()=>validateDefinition(copied,{program_code:'EMPG'}));
});
