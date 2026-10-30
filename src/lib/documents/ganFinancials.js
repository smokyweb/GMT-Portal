import {ganCents,formatGanCents,normalizePoete,POETE_CATEGORIES} from './ganFormatting.js';
const categoryToken={Planning:'budget_planning',Organization:'budget_organization',Equipment:'budget_equipment',Training:'budget_training',Exercises:'budget_exercises','Management & Administration':'budget_ma'};
export function ganFinancials({application,award,nofo={},budgets=[],projects=[]},issue) {
  const fields=award?.fields||{},sums=Object.fromEntries(POETE_CATEGORIES.map(category=>[category,0n]));let total=0n,budgetMatch=0n;
  for(const [index,line] of budgets.entries()) {
    const category=normalizePoete(line.poete),amount=ganCents(line.federal_amount??line.amount_requested),lineMatch=ganCents(line.match_amount??line.amount_match??0);
    if(lineMatch===null)issue('match_total','Enter a valid match amount for budget line '+(index+1),'ApplicationBudget',line.id,'amount_match');
    else budgetMatch+=lineMatch;
    if(!category)issue('budget_total','Classify budget line '+(index+1)+' by POETE','ApplicationBudget',line.id,'poete');
    if(amount===null){issue('budget_total','Enter a valid federal amount for budget line '+(index+1),'ApplicationBudget',line.id,'amount_requested');continue;}
    if(line.is_allowable===false&&amount>0n)issue('budget_total','Resolve the unallowable cost in budget line '+(index+1),'ApplicationBudget',line.id,'is_allowable');
    total+=amount;if(category)sums[category]+=amount;
  }
  const awarded=ganCents(fields.awarded_amount),match=ganCents(fields.match_amount);
  if(awarded===null||awarded<=0n)issue('total_award_amount','Enter a positive award amount','AwardDetails',award?.id,'awarded_amount');
  const federalAward=ganCents(nofo.total_federal_award);
  if(awarded!==null&&federalAward!==null&&awarded>federalAward)issue('total_federal_award','The subaward cannot exceed the federal award to the state','Nofo',nofo.id,'total_federal_award');
  if(match!==null&&budgetMatch!==match)issue('match_total','Budget line match amounts must equal the award match commitment','ApplicationBudget',application.id,'amount_match');
  if(awarded!==null&&total!==awarded)issue('budget_total','The POETE federal budget must equal the total award amount','ApplicationBudget',application.id,'amount_requested');
  const nonzero=POETE_CATEGORIES.filter(category=>sums[category]>0n);
  const rows=projects.length?projects:[{project_id:application.application_number?application.application_number+'-P1':null,name:application.project_title,
    poete:application.main_poete||(nonzero.length===1?nonzero[0]:null),federal_amount:fields.awarded_amount,match_amount:fields.match_amount,legacy:true}];
  let projectFederal=0n,projectMatch=0n;const seen=new Set(),prepared=[];
  for(const project of rows) {
    const id=project.project_id||project.project_number,category=normalizePoete(project.poete||project.main_poete),federal=ganCents(project.federal_amount??project.federal),costMatch=ganCents(project.match_amount??project.match);
    if(!id||!application.application_number||!id.startsWith(application.application_number+'-P')||!/^P[1-9]\d*$/.test(id.slice(application.application_number.length+1))||seen.has(id))issue('projects','Use a unique full project ID under this application','Project',project.id,'project_id');
    seen.add(id);
    if(!String(project.name||'').trim())issue('projects','Enter a project name','Project',project.id,'name');
    if(!category)issue('projects','Choose the project main POETE category','Project',project.id,'poete');
    if(federal===null||costMatch===null)issue('projects','Enter valid project federal and match amounts','Project',project.id,'amounts');
    if(federal!==null)projectFederal+=federal;if(costMatch!==null)projectMatch+=costMatch;
    prepared.push({project_id:id||'',name:project.name||'',poete:category||'',federal:federal===null?undefined:formatGanCents(federal),match:costMatch===null?undefined:formatGanCents(costMatch),legacy:project.legacy===true});
  }
  if(awarded!==null&&projectFederal!==awarded)issue('projects','Project federal allocations must equal the award amount','Project',application.id,'federal_amount');
  if(match===null)issue('match_amount','Enter an explicit match commitment, including zero when none is required','AwardDetails',award?.id,'match_amount');
  else if(projectMatch!==match)issue('match_total','Project match allocations must equal the award match commitment','Project',application.id,'match_amount');
  return {values:{...Object.fromEntries(POETE_CATEGORIES.map(category=>[categoryToken[category],formatGanCents(sums[category])])),budget_total:formatGanCents(total),match_total:match===null?undefined:formatGanCents(match)},projects:prepared,requiresProjectSchedule:prepared.length>4};
}
