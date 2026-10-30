import {randomUUID} from 'node:crypto';
import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ehpApplication,requireEhpAdmin,needsEhp,expectEhpRevision} from './ehpAccess.js';
export async function readEhp(db,actorId,id) {
  const {actor,application}=await ehpApplication(db,actorId,id);
  const budgets=(await db.query('SELECT * FROM application_budgets WHERE application_id=$1 ORDER BY created_date,id',[id])).rows;
  const history=(await db.query('SELECT * FROM ehp_decisions WHERE application_id=$1 ORDER BY revision DESC',[id])).rows;
  return {application,budgets,history,required:needsEhp(application,budgets),can_edit:['isc_admin','admin'].includes(actor.role)};
}
export async function classifyEhpBudget(pool,actorId,id,lineId,input) {
  return transaction(pool,async db=>{
    const {actor,application}=await ehpApplication(db,actorId,id,true);requireEhpAdmin(actor);expectEhpRevision(application,input);
    if(typeof input.affected!=='boolean')throw accountError(400,'Select whether this cost is affected by EHP');
    const row=(await db.query('UPDATE application_budgets SET ehp_affected=$3,updated_date=NOW() WHERE id::text=$1 AND application_id=$2 RETURNING *',[lineId,id,input.affected])).rows[0];
    if(!row)throw accountError(404,'Application budget line not found');
    const revision=application.ehp_review_revision+1;
    await db.query(`UPDATE applications SET ehp_review_revision=$2,ehp_status=CASE WHEN $3 OR ehp_required THEN 'ScreeningRequired' ELSE ehp_status END,
      ehp_approval_date=CASE WHEN $3 OR ehp_required THEN NULL ELSE ehp_approval_date END,updated_date=NOW() WHERE id=$1`,[id,revision,input.affected]);
    await auditForm(db,actor,id,'EhpCostClassified',row.line_description+': '+(input.affected?'affected by EHP; approval required':'not affected by EHP'),'Application');
    return readEhp(db,actorId,id);
  });
}
export async function recordEhpDecision(pool,actorId,id,input) {
  return transaction(pool,async db=>{
    const {actor,application}=await ehpApplication(db,actorId,id,true);requireEhpAdmin(actor);expectEhpRevision(application,input);
    if(!['Approved','ScreeningRequired'].includes(input.decision))throw accountError(400,'Choose approval or reopen review');
    const budgets=(await db.query('SELECT * FROM application_budgets WHERE application_id=$1',[id])).rows;
    if(input.decision==='Approved'&&!needsEhp(application,budgets))throw accountError(400,'Record why EHP review is required before recording approval');
    const notes=String(input.notes||'').trim(),reference=String(input.reference||'').trim(),date=String(input.date||'');
    if(notes.length>10000||reference.length>500)throw accountError(400,'EHP review notes or reference is too long');
    if(input.decision==='Approved'&&(!reference||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10)))throw accountError(400,'Record the approval reference and a valid approval date');
    if(input.decision==='ScreeningRequired'&&!notes)throw accountError(400,'Explain why EHP review is being reopened');
    const revision=application.ehp_review_revision+1;
    await db.query(`INSERT INTO ehp_decisions(id,application_id,decision,approval_reference,approval_date,notes,recorded_by,revision)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),id,input.decision,reference||null,input.decision==='Approved'?date:null,notes,actor.email,revision]);
    await db.query('UPDATE applications SET ehp_status=$2,ehp_required=true,ehp_approval_date=$3,ehp_review_revision=$4,ehp_manual_required=$5,updated_date=NOW() WHERE id=$1',[id,input.decision,input.decision==='Approved'?date:null,revision,application.ehp_manual_required||!needsEhp(application,budgets)]);
    await auditForm(db,actor,id,input.decision==='Approved'?'EhpApprovalRecorded':'EhpReviewReopened',input.decision+(reference?' · '+reference:'')+(notes?' · '+notes:''),'Application');
    return readEhp(db,actorId,id);
  });
}
