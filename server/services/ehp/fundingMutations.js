import {notifyFundingDecision} from './fundingDecisionNotice.js';
import {applyFundingApproval} from './fundingBalances.js';
import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {ehpApplication} from './ehpAccess.js';
import {checkFundingRelease} from './ehpFundingPolicy.js';
import {writeFundingRow,fundingDates,fundingNumber} from './fundingRepository.js';
const userKeys=['application_id','request_type','period_start','period_end','match_documented','modification_type','modification_justification','scope_of_work_current','scope_of_work_proposed','budget_modification_notes','status'];
const release=request=>['Submitted','UnderReview','Approved'].includes(request.status)||(Boolean(request.payment_status)&&!['PendingDisbursement','PaymentFailed'].includes(request.payment_status));
export async function mutateFunding(pool,actorId,entity,id,input={},method='PUT') {
  return transaction(pool,async db=>{
    const table=entity==='FundingRequest'?'funding_requests':'funding_request_line_items',lineEntity=table==='funding_request_line_items';
    let previous=id?(await db.query('SELECT * FROM '+table+' WHERE id::text=$1',[id])).rows[0]:null;
    if(id&&!previous)throw accountError(404,'Funding record not found');
    let request=lineEntity?(await db.query('SELECT * FROM funding_requests WHERE id::text=$1',[previous?.funding_request_id||previous?.fund_request_id||input.funding_request_id||input.fund_request_id])).rows[0]:previous;
    if(lineEntity&&!request)throw accountError(404,'Funding request not found');
    const {actor,application,organization}=await ehpApplication(db,actorId,request?.application_id||input.application_id,true);
    if(request)request=(await db.query('SELECT * FROM funding_requests WHERE id=$1 FOR UPDATE',[request.id])).rows[0];
    if(previous)previous=(await db.query('SELECT * FROM '+table+' WHERE id=$1 FOR UPDATE',[id])).rows[0];
    const data={...input};
    if(!lineEntity&&request&&data.request_type&&data.request_type!==request.request_type)throw accountError(400,'Create a new request to change the request type');
    if(!lineEntity&&data.application_id&&data.application_id!==application.id)throw accountError(400,'A funding request cannot move to another grant');
    if(lineEntity&&['funding_request_id','fund_request_id'].some(key=>data[key]&&data[key]!==request.id))throw accountError(400,'An expenditure cannot move to another request');
    if(lineEntity&&data.application_budget_id&&(await db.query('SELECT id FROM application_budgets WHERE id::text=$1 AND application_id=$2',[data.application_budget_id,application.id])).rows.length===0)throw accountError(400,'Choose a budget line from this application');
    const requestedProjectId=data.project_id||request?.project_id||input.project_id;
    if(requestedProjectId&&(await db.query('SELECT id FROM projects WHERE id::text=$1 AND application_id=$2',[requestedProjectId,application.id])).rows.length===0)throw accountError(400,'Choose a project from this application');
    if(actor.role==='user') {
      if(request&&!['Draft','AdditionalInfoRequested'].includes(request.status))throw accountError(409,'This request is not open for editing');
      const allowed=lineEntity?['funding_request_id','fund_request_id','project_id','budget_category','description','amount','amount_requested','application_budget_id','ehp_affected','invoice_number','invoice_date','vendor']:userKeys.concat('project_id');
      if(Object.keys(data).some(key=>!allowed.includes(key)))throw accountError(403,'Only a reviewer can change funding review or payment fields');
      if(!lineEntity&&data.status&&!['Draft','Submitted'].includes(data.status))throw accountError(403,'Use the review workflow for funding decisions');
    }
    if(lineEntity&&['Approved','Paid'].includes(request.status))throw accountError(409,'Approved expenditure lines are locked');
    if(lineEntity&&request.payment_status==='Paid')throw accountError(409,'Paid expenditure lines are locked');
    if(method==='DELETE') {
      if(!lineEntity&&(request.payment_status==='Paid'||request.status!=='Draft'))throw accountError(409,'Only a draft funding request can be deleted');
      await db.query('DELETE FROM '+table+' WHERE id=$1',[id]);await auditForm(db,actor,request?.id||id,'FundingRecordDeleted','Removed '+entity,'FundingRequest');return {success:true};
    }
    if(lineEntity) {
      if(data.ehp_affected!==undefined&&data.ehp_affected!==null&&typeof data.ehp_affected!=='boolean')throw accountError(400,'EHP classification must be yes or no');
      const saved=await writeFundingRow(db,table,id,{...data,project_id:data.project_id||request.project_id||null,funding_request_id:request.id});
      if(release(request)&&['Approved','Paid'].includes(request.status))await checkFundingRelease(db,application,request);
      return saved;
    }
    if(!id) {
      if(data.status&&data.status!=='Draft')throw accountError(400,'Submit the request and its expenditure lines together using the request form');
      if(application.status!=='Approved')throw accountError(409,'Select an approved grant');
      Object.assign(data,{status:'Draft',request_number:await fundingNumber(db),submitted_by:actor.email});
    }
    Object.assign(data,{application_id:application.id,application_number:application.application_number,organization_id:organization.id,organization_name:organization.name,program_code:application.program_code,project_id:data.project_id||request?.project_id||null});
    const proposed={...previous,...data};fundingDates(proposed);
    if(proposed.request_type==='Modification') {
      if(proposed.payment_status&&!['PendingDisbursement','PaymentFailed'].includes(proposed.payment_status))throw accountError(400,'A modification request is not payable');
      data.amount_requested=0;data.amount_approved=0;
    } else if(release(proposed))data.amount_requested=await checkFundingRelease(db,application,proposed);
    await applyFundingApproval(db,application,previous,{...proposed,...data});
    const saved=await writeFundingRow(db,table,id,data);
    await notifyFundingDecision(db,actor,previous,saved);
    await auditForm(db,actor,saved.id,'FundingRequestUpdated','Funding request '+saved.request_number+': '+saved.status+(saved.payment_status?' · '+saved.payment_status:''),'FundingRequest');
    return saved;
  });
}
