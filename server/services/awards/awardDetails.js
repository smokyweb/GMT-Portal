import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {formActor,assertApplicationAccess,auditForm} from '../forms/formAccess.js';
import {awardSources,ensureAwardSnapshot} from './awardRepository.js';
import {AWARD_FIELDS} from '../../../src/lib/awards/awardFields.js';
import {validateAwardChanges} from './awardValidation.js';
import {moneyCents} from '../forms/valueValidation.js';
async function access(db,actorId,id,lock=false) {
  const actor=await formActor(db,actorId),application=(await db.query('SELECT * FROM applications WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const sources=await awardSources(db,application);assertApplicationAccess(actor,application,sources.organization);
  return {actor,application,sources};
}
export async function readAwardDetails(db,actorId,id) {
  const {actor,application,sources}=await access(db,actorId,id);
  let award=(await db.query('SELECT * FROM award_details WHERE application_id=$1',[id])).rows[0];
  if(['isc_admin','admin'].includes(actor.role))award=await transaction(db,async client=>{
    const locked=await access(client,actorId,id,true);
    return ensureAwardSnapshot(client,locked.application,locked.actor);
  });
  return {application,award:award||{id:null,application_id:id,revision:0,fields:sources.fields,origins:sources.origins,field_overrides:{}},
    inherited:sources.fields,can_edit:['isc_admin','admin'].includes(actor.role),nofo_title:sources.nofo.title||null};
}
export async function saveAwardDetails(pool,actorId,id,input) {
  try{return await transaction(pool,async db=>{
    const {actor,application,sources}=await access(db,actorId,id,true);
    if(!['isc_admin','admin'].includes(actor.role))throw accountError(403,'Only an assigned administrator can edit Award Details');
    const previous=(await db.query('SELECT * FROM award_details WHERE application_id=$1 FOR UPDATE',[id])).rows[0];
    if(input.expectedRevision!==(previous?.revision||0))throw accountError(409,'Award Details changed. Reload before saving.');
    const award=await ensureAwardSnapshot(db,application,actor),fields={...award.fields},origins={...award.origins},overrides={...award.field_overrides};
    const reset=input.resetFields||[];if(!Array.isArray(reset)||reset.some(key=>!AWARD_FIELDS.some(field=>field.key===key&&field.inherited)))throw accountError(400,'Choose inherited fields to restore from the source');
    const changes=validateAwardChanges(fields,input.fields||{});
    for(const key of reset){fields[key]=sources.fields[key];origins[key]=sources.origins[key];delete overrides[key];}
    for(const [key,value] of Object.entries(changes)){fields[key]=value;origins[key]='Award override';overrides[key]=true;}
    validateAwardChanges({},fields);
    const saved=(await db.query('UPDATE award_details SET fields=$2,origins=$3,field_overrides=$4,revision=revision+1,updated_at=NOW() WHERE id=$1 RETURNING *',
      [award.id,JSON.stringify(fields),JSON.stringify(origins),JSON.stringify(overrides)])).rows[0];
    const spent=moneyCents(application.total_expended??0),amount=moneyCents(fields.awarded_amount??0);
    if(spent===null||amount===null)throw accountError(409,'Review the existing award and expenditure amounts before saving');
    if(amount<spent)throw accountError(409,'Award amount cannot be lower than expenditure already approved');
    await db.query('UPDATE applications SET awarded_amount=$2,match_amount=$3,performance_start=$4,performance_end=$5,grant_number=$6,remaining_balance=$7,expenditure_rate=$8,updated_date=NOW() WHERE id=$1',
      [id,fields.awarded_amount,fields.match_amount,fields.award_start,fields.award_close,fields.federal_award_number,(amount-spent)/100,amount?Math.round(spent/amount*10000)/100:0]);
    await auditForm(db,actor,id,'AwardDetailsUpdated','Updated Award Details revision '+saved.revision+'; fields: '+[...new Set([...Object.keys(changes),...reset])].join(', '),'Application');
    return readAwardDetails(db,actorId,id);
  });}catch(error){if(error.code==='23505')throw accountError(409,'That Sub-Award Grant Number already exists under this NOFO');throw error;}
}
