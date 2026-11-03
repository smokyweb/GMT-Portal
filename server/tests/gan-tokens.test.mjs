import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveGanTokens,ganTemplateTokens} from '../../src/lib/documents/ganTokens.js';
import {canonicalGanTemplate,hasFixedGanAwardData} from '../../src/lib/documents/ganTemplateBody.js';
import {ganMoney,ganDate,ganDueDate} from '../../src/lib/documents/ganFormatting.js';
const source=code=>fs.readFileSync(new URL('../../docs/project/basecamp-gan/GAN_'+code+'_portal_body.md',import.meta.url),'utf8');
const template=code=>canonicalGanTemplate(source(code));
function data(code='EMPG') {
  return {application:{id:'app',application_number:'APP-2026-00101',status:'Approved',project_title:'QA communications project',project_narrative:'QA scope of work',requested_amount:500},
    award:{id:'award',fields:{federal_award_number:'EMK-2026-EP-05006',subaward_number:'NE-EMPG-001',state_grant_number:'NE-2026',cfda_number:'97.042',federal_award_date:'2026-08-01',award_start:'2026-10-01',award_close:'2027-09-30',awarded_amount:500,match_amount:500,award_status:'Pending'}},
    nofo:{id:'nofo',title:'QA FY2026 NOFO',program_name:'QA Federal Program',fiscal_year:2026,cfda_title:'QA Assistance Listing',total_federal_award:1000000,statutory_authority:'QA authority',federal_award_description:'QA federal purpose',indirect_cost_rate:0,is_r_and_d:false,match_requirement:50},
    program:{id:'program',code,name:'QA Full Grant Name',program_year:2026,federal_agency:'QA Federal Agency',match_requirement:50},
    organization:{id:'org',name:'QA County',address:'100 QA Road',city:'Lincoln',state:'NE',zip:'68508',sam_uei:'QA1234567890',ein:'12-3456789'},
    authorizedOfficial:{id:'official',organization_id:'org',full_name:'QA Authorized Official',title:'Emergency Manager',email:'official@gan-qa.invalid',phone:'555-0100',active_status:'active'},
    grantee:{id:'grantee',agency_name:'QA State Agency',contact_name:'QA Contact',contact_title:'Grant Coordinator',contact_phone:'555-0200',contact_email:'contact@gan-qa.invalid',approving_official_name:'QA Approver',approving_official_title:'Assistant Director'},
    actor:{id:'admin',full_name:'QA Administrator'},awardDate:'2026-10-29',
    budgets:[{id:'budget',poete:'Equipment',budget_category:'Equipment',line_description:'QA radios',amount_requested:500,amount_match:500}],projects:[]};
}
test('Client GAN templates keep their thirteen blocks and use current record tokens',()=>{
  for(const code of ['EMPG','NSGP','SHSP','SLCGP']) {
    const original=source(code),body=template(code);assert.equal(hasFixedGanAwardData(original),true);assert.equal(hasFixedGanAwardData(body),false);
    for(let number=1;number<=13;number++)assert.ok(body.includes(number+'.'),code+' block '+number);
    assert.ok(body.includes('{{federal_award_number}}'));assert.ok(body.includes('{{cfda_number}}'));assert.ok(body.includes('{{project_breakdown}}'));
    const result=resolveGanTokens(body,data(code));assert.deepEqual(result.issues,[]);assert.equal(result.ready,true);assert.ok(!result.body.includes('{{'));
    assert.ok(result.body.includes('2026 Sub-Recipient Agreement'));assert.ok(result.body.includes('EMK-2026-EP-05006 / 97.042'));assert.ok(result.body.includes('QA Authorized Official'));
    assert.ok(original.includes('Special Conditions'));assert.ok(body.includes('Special Conditions'));
  }
});
test('Raw historical templates cannot silently send fixed award years or FAINs',()=>{
  const result=resolveGanTokens(source('EMPG'),data());assert.equal(result.ready,false);assert.ok(result.issues.some(issue=>issue.source.record==='Template'&&issue.reason.includes('hard-coded')));
});
test('Missing fields identify the record, field and screen where they are corrected',()=>{
  const input=data();delete input.authorizedOfficial.email;delete input.nofo.cfda_title;
  const result=resolveGanTokens(template('EMPG'),input);assert.equal(result.ready,false);
  const email=result.issues.find(issue=>issue.token==='authorized_official_email');assert.equal(email.source.record,'User');assert.equal(email.source.id,'official');assert.equal(email.source.field,'email');
  const cfda=result.issues.find(issue=>issue.token==='cfda_title');assert.equal(cfda.source.record,'Nofo');assert.equal(cfda.source.field,'cfda_title');
});
test('Zero indirect rate and a No R&D choice resolve; optional DBA is allowed to remain empty',()=>{
  const result=resolveGanTokens(template('EMPG'),data());assert.equal(result.values.indirect_cost_rate,'0%');assert.equal(result.values.is_r_and_d,'No');assert.equal(result.values.site_name,'');assert.equal(result.ready,true);
});
test('Unknown tokens and record values containing template expressions block sending',()=>{
  const unknown=resolveGanTokens(template('EMPG')+' {{unregistered_token}}',data());assert.equal(unknown.ready,false);assert.ok(unknown.issues.some(issue=>issue.token==='unregistered_token'&&issue.source.record==='Template'));
  const input=data();input.organization.name='QA {{federal_award_number}}';const result=resolveGanTokens(template('EMPG'),input);
  assert.equal(result.ready,false);assert.ok(result.issues.some(issue=>issue.reason.includes('introduce template tokens')));
});
test('Authorized officials must be registered, active and associated with the recipient organization',()=>{
  for(const change of [{id:null},{active_status:'inactive'},{organization_id:'other-org'}]) {
    const input=data();Object.assign(input.authorizedOfficial,change);const result=resolveGanTokens(template('EMPG'),input);assert.equal(result.ready,false);assert.ok(result.issues.some(issue=>issue.token==='authorized_official_email'));
  }
  const input=data();input.authorizedOfficial.organization_id='other-org';input.authorizedOfficial.organization_ids=['org'];assert.equal(resolveGanTokens(template('EMPG'),input).ready,true);
});
test('POETE must be explicit and federal budget totals are separate from match',()=>{
  const input=data();input.budgets[0].poete=null;input.budgets[0].budget_category='Personnel';
  const result=resolveGanTokens(template('EMPG'),input);assert.equal(result.ready,false);assert.ok(result.issues.some(issue=>issue.source.record==='ApplicationBudget'&&issue.source.field==='poete'));
  const valid=resolveGanTokens(template('EMPG'),data());assert.equal(valid.values.budget_total,'$500.00');assert.equal(valid.values.match_total,'$500.00');
});
test('Budget, project federal totals and project match totals must reconcile with the award',()=>{
  const input=data();input.budgets[0].amount_requested=499;assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
  const projectData=data();projectData.projects=[{project_id:'APP-2026-00101-P1',name:'QA P1',poete:'Equipment',federal_amount:400,match_amount:500}];
  assert.ok(resolveGanTokens(template('EMPG'),projectData).issues.some(issue=>issue.reason.includes('Project federal allocations')));
  projectData.projects[0].federal_amount=500;projectData.projects[0].match_amount=400;assert.ok(resolveGanTokens(template('EMPG'),projectData).issues.some(issue=>issue.reason.includes('Project match allocations')));
});
test('Project IDs remain application-specific and a schedule is required above four projects',()=>{
  const input=data();input.projects=Array.from({length:5},(_,index)=>({id:'p'+index,project_id:'APP-2026-00101-P'+(index+1),name:'QA P'+(index+1),poete:'Equipment',federal_amount:100,match_amount:100}));
  const result=resolveGanTokens(template('EMPG'),input);assert.equal(result.ready,true);assert.equal(result.requiresProjectSchedule,true);assert.ok(result.values.project_breakdown.includes('See attached Project Schedule'));assert.equal(result.projects.length,5);
  input.projects[1].project_id=input.projects[0].project_id;assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
  input.projects[1].project_id='APP-OTHER-P2';assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
});
test('A legacy single project is identified as P1; a mixed budget needs an explicit main POETE',()=>{
  const single=resolveGanTokens(template('EMPG'),data());assert.equal(single.projects[0].project_id,'APP-2026-00101-P1');assert.equal(single.projects[0].legacy,true);assert.equal(single.requiresProjectSchedule,false);
  const input=data();input.budgets=[{poete:'Planning',amount_requested:250,amount_match:250},{poete:'Equipment',amount_requested:250,amount_match:250}];
  assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.reason.includes('main POETE')));
  input.application.main_poete='Planning';assert.equal(resolveGanTokens(template('EMPG'),input).ready,true);
});
test('Currency formatting and match boundary checks retain exact cents',()=>{
  assert.equal(ganMoney('999999999999.99'),'$999,999,999,999.99');assert.equal(ganMoney('0.001'),undefined);
  const input=data();input.award.fields.awarded_amount='66.67';input.award.fields.match_amount='33.33';input.budgets[0].amount_requested='66.67';input.budgets[0].amount_match='33.33';input.nofo.match_requirement=33.33;
  assert.equal(resolveGanTokens(template('EMPG'),input).ready,true);
  input.award.fields.awarded_amount='66.68';input.award.fields.match_amount='33.32';input.budgets[0].amount_requested='66.68';input.budgets[0].amount_match='33.32';
  assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.reason.includes('33.33%')));
});
test('The pinned form cost-share rule takes precedence over newer NOFO defaults',()=>{
  const input=data();input.nofo.match_requirement=0;input.formDefinition={rules:{matchPercent:50}};input.award.fields.match_amount=0;
  assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.reason.includes('50%')));
});
test('Dates use calendar days in UTC and invalid values do not silently format',()=>{
  assert.equal(ganDate('2026-02-31'),undefined);assert.equal(ganDate('2026-10-29'),'October 29, 2026');assert.equal(ganDueDate('2028-02-28'),'2028-03-29');assert.equal(ganDueDate(new Date('2028-02-28T00:00:00Z')),'2028-03-29');
  const input=data();input.dueDate='2026-10-01';assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
  input.dueDate='2026-11-28';input.award.fields.federal_award_date='invalid';assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.token==='federal_award_date'));
});
test('Award overrides survive newer NOFO edits and merged results are independent snapshots',()=>{
  const input=data();input.nofo.grant_number='EMK-2026-EP-99999';const result=resolveGanTokens(template('EMPG'),input);
  assert.equal(result.values.federal_award_number,'EMK-2026-EP-05006');input.organization.name='Changed later';input.award.fields.subaward_number='Changed later';
  assert.ok(result.body.includes('QA County'));assert.ok(result.body.includes('NE-EMPG-001'));assert.ok(!result.body.includes('Changed later'));
});
test('Unapproved, held and mismatched-program awards cannot produce ready GANs',()=>{
  const input=data();input.application.status='Draft';assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
  input.application.status='Approved';input.award.fields.award_status='On Hold';assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
  input.award.fields.award_status='Pending';input.programCodes=['NSGP'];assert.equal(resolveGanTokens(template('EMPG'),input).ready,false);
});
test('Legacy token aliases remain usable and missing aliases keep their source record',()=>{
  const input=data();const result=resolveGanTokens('{{awarded_amount}} / {{performance_start}} / {{today_date}}',input);assert.equal(result.ready,true);assert.equal(result.body,'$500.00 / October 1, 2026 / October 29, 2026');
  input.award.fields.award_start=null;const missing=resolveGanTokens('{{performance_start}}',input);assert.equal(missing.issues.find(issue=>issue.token==='performance_start').source.record,'AwardDetails');
  assert.deepEqual(ganTemplateTokens('{{organization_name}} {{organization_name}} {{projects[].name}}'),['organization_name','projects[].name']);
});

test('Malformed placeholders and whitespace-only source values remain blocked',()=>{
  for(const text of ['{{}}','{{organization_name','organization_name}}'])assert.equal(resolveGanTokens(text,data()).ready,false);
  const input=data();input.authorizedOfficial.email='   ';const result=resolveGanTokens(template('EMPG'),input);assert.ok(result.issues.some(issue=>issue.token==='authorized_official_email'));
});
test('Budget match commitments and the federal award ceiling are checked separately',()=>{
  const input=data();input.budgets[0].amount_match=499;assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.reason.includes('Budget line match')));
  input.budgets[0].amount_match=500;input.nofo.total_federal_award=499;assert.ok(resolveGanTokens(template('EMPG'),input).issues.some(issue=>issue.reason.includes('cannot exceed the federal award')));
});
