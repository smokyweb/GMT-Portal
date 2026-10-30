import {assertGanFundingReady} from '../documents/ganFundingGate.js';
import {accountError} from '../accountPolicy.js';
import {needsEhp,hasEhpApproval} from './ehpAccess.js';
import {moneyCents} from '../forms/valueValidation.js';
export async function checkFundingLines(db,application,request,lines) {
  await assertGanFundingReady(db,application.id);
  if(request.request_type==='Modification')return;
  if(!lines.length)throw accountError(422,'Add at least one expenditure line');
  const budgets=(await db.query('SELECT * FROM application_budgets WHERE application_id=$1',[application.id])).rows;
  const required=needsEhp(application,budgets),errors=[];
  for(const [index,line] of lines.entries()) {
    const label='Item '+(index+1),budget=budgets.find(row=>row.id===line.application_budget_id);
    if(moneyCents(line.amount_requested??line.amount)===null||moneyCents(line.amount_requested??line.amount)<=0)errors.push(label+': enter a positive amount with at most two decimals');
    if(!String(line.description||'').trim())errors.push(label+': enter a description');
    if(line.application_budget_id&&!budget)errors.push(label+': budget line belongs to another application or is unavailable');
    if(required&&budgets.length&&!budget)errors.push(label+': select the application budget line');
    const affected=budget?budget.ehp_affected:line.ehp_affected;
    if(required&&affected!==true&&affected!==false)errors.push(label+': an administrator must classify the budget line for EHP');
    if((affected===true||line.ehp_affected===true)&&!hasEhpApproval(application))errors.push(label+': EHP approval must be recorded before reimbursement of this affected cost');
    if(budget?.ehp_affected===true)line.ehp_affected=true;
    else if(budget?.ehp_affected===false&&line.ehp_affected!==true)line.ehp_affected=false;
  }
  if(errors.length)throw Object.assign(accountError(422,'Resolve expenditure line requirements before submitting or approving'),{details:errors.map(message=>({message}))});
}
export async function checkFundingRelease(db,application,request) {
  if(request.request_type==='Modification'){await assertGanFundingReady(db,application.id);return;}
  const lines=(await db.query('SELECT * FROM funding_request_line_items WHERE funding_request_id=$1 OR fund_request_id=$1',[request.id])).rows;
  await checkFundingLines(db,application,request,lines);
  const total=lines.reduce((sum,line)=>sum+moneyCents(line.amount_requested??line.amount),0);
  if(!Number.isSafeInteger(total))throw accountError(400,'Requested amount is too large');
  return total/100;
}
