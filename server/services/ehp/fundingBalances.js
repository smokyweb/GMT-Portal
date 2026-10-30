import {accountError} from '../accountPolicy.js';
import {moneyCents} from '../forms/valueValidation.js';
export async function applyFundingApproval(db,application,previous,proposed) {
  const next=proposed.status==='Approved'?moneyCents(proposed.amount_approved??proposed.amount_requested??0):0;
  const old=previous?.status==='Approved'?moneyCents(previous.amount_approved??previous.amount_requested??0):0;
  if(next===null||old===null)throw accountError(400,'Enter a valid approved amount');
  if(next>moneyCents(proposed.amount_requested??0))throw accountError(400,'Approved amount cannot exceed the requested expenditure total');
  if(next===old)return;
  const expended=(moneyCents(application.total_expended??0)||0)+next-old,award=moneyCents(application.awarded_amount??0)||0;
  if(!Number.isSafeInteger(expended)||expended<0)throw accountError(409,'The grant balance needs review before changing this approval');
  await db.query('UPDATE applications SET total_expended=$2,remaining_balance=$3,expenditure_rate=$4,updated_date=NOW() WHERE id=$1',
    [application.id,expended/100,(award-expended)/100,award?Math.round(expended/award*10000)/100:0]);
}
