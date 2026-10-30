import {auditForm} from '../forms/formAccess.js';
import {accountError} from '../accountPolicy.js';
import {moneyCents} from '../forms/valueValidation.js';
import {awardsEnabled,ensureAwardSnapshot} from './awardRepository.js';
import {inputDate} from '../../../src/lib/awards/awardFields.js';
export async function syncApplicationAward(db,application,previous,actor) {
  if(!await awardsEnabled(db))return application;
  const exists=(await db.query('SELECT id FROM award_details WHERE application_id=$1',[application.id])).rows.length;
  if(application.status!=='Approved'&&!exists)return application;
  const award=await ensureAwardSnapshot(db,application,actor),fields={...award.fields},origins={...award.origins};
  let changed=false;
  for(const [key,source] of [['awarded_amount','awarded_amount'],['match_amount','match_amount'],['award_start','performance_start'],['award_close','performance_end']]) {
    const raw=application[source],value=key.endsWith('_start')||key.endsWith('_close')?inputDate(raw)||null:raw??null;
    const old=previous?.[source],changedValue=key.endsWith('_start')||key.endsWith('_close')?inputDate(old)!==inputDate(raw):moneyCents(old??0)!==moneyCents(raw??0);
    if(changedValue&&(key.endsWith('_start')||key.endsWith('_close')?String(fields[key]??'')!==String(value??''):moneyCents(fields[key]??0)!==moneyCents(value??0))){fields[key]=value;origins[key]='from Application';changed=true;}
  }
  if(changed){await db.query('UPDATE award_details SET fields=$2,origins=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[award.id,JSON.stringify(fields),JSON.stringify(origins)]);await auditForm(db,actor,application.id,'AwardDetailsSynchronized','Synchronized application award amounts and dates while preserving federal identifier overrides','Application');}
  const awardCents=moneyCents(application.awarded_amount??0),spent=moneyCents(previous?.total_expended??application.total_expended??0);
  if(awardCents===null)throw accountError(400,'Enter a nonnegative award amount with at most two decimals');
  if(spent===null)throw accountError(409,'Existing grant expenditure needs review before changing the award');
  if(awardCents<spent)throw accountError(409,'Award amount cannot be lower than expenditure already approved');
  const saved=(await db.query('UPDATE applications SET grant_number=$2,total_expended=$3,remaining_balance=$4,expenditure_rate=$5 WHERE id=$1 RETURNING *',
    [application.id,Object.hasOwn(fields,'federal_award_number')?fields.federal_award_number:application.grant_number||null,spent/100,(awardCents-spent)/100,awardCents?Math.round(spent/awardCents*10000)/100:0])).rows[0];
  return saved;
}
