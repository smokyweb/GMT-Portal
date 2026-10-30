import {defaultForm} from '../../src/lib/forms/defaultForm.js';
import {valuesForAudience} from '../services/forms/valueValidation.js';
import {applicationForFormExport} from '../services/forms/formAuditExport.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readableValue} from '../../src/lib/forms/formPresentation.js';
import {formExportCsv} from '../../src/lib/forms/formExports.js';
import {fileReference} from '../services/forms/valueValidation.js';
test('Form files accept the actual API URL and legacy upload URLs without allowing external or traversing paths',()=>{
  assert.equal(fileReference('/api/files/qa-document.pdf'),true);
  assert.equal(fileReference('/uploads/qa-document.pdf'),true);
  for(const value of ['https://example.org/file.pdf','/api/files/../secret','/api/files/%2e%2e','/api/files/a/b','/uploads/.hidden'])assert.equal(fileReference(value),false);
});
test('Form values use readable dates, amounts, EHP answers and repeating column labels',()=>{
  assert.equal(readableValue('2026-10-01T00:00:00.000Z',{type:'date'}),'2026-10-01');
  assert.equal(readableValue('100',{type:'currency'}),'$100.00');
  assert.equal(readableValue('unknown',{type:'yesno'}),'Unsure');
  assert.equal(readableValue([{nims:'Complete'}],{type:'table',columns:[{id:'nims',label:'NIMS Training',type:'text'}]}),'NIMS Training: Complete');
});
test('Form CSV includes configured section labels, quotes cells and neutralizes formulas',()=>{
  const result=formExportCsv([{sectionId:'section_123',sectionLabel:'Personnel',label:'Staff, name',type:'text',value:'=HYPERLINK("bad")'}]);
  assert.ok(result.includes('"Personnel","Staff, name",'));
  assert.ok(result.includes(`"'=HYPERLINK(""bad"")"`));
});

test('Audit application JSON honors excluded standard, EHP, organization and custom fields',()=>{
  const definition=defaultForm({program_code:'EMPG'});
  definition.sections[0].fields[0].exportVisible=false;
  definition.sections[1].fields[0].exportVisible=false;
  definition.sections.find(section=>section.kind==='ehp').fields[0].exportVisible=false;
  for(const [id,visible] of [['cf_hidden',false],['cf_kept',true]])definition.sections[1].fields.push({id,key:id,label:id,type:'text',source:'custom',required:false,visible:true,reviewerVisible:true,exportVisible:visible});
  const application={project_title:'Excluded title',organization_name:'Excluded org',ehp_screening_answers:{q1:'unknown',q2:'no'},form_values:{cf_hidden:'Excluded custom',cf_kept:'Included custom'}};
  const fields=valuesForAudience(definition,{application,values:application.form_values},'export');
  const output=applicationForFormExport(application,{version:{definition},fields,values:{cf_kept:'Included custom'}});
  assert.equal(output.project_title,undefined);assert.equal(output.organization_name,undefined);assert.deepEqual(output.form_values,{cf_kept:'Included custom'});assert.equal(JSON.parse(output.ehp_screening_answers).q1,undefined);
});
