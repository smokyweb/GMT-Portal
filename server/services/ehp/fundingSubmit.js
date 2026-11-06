import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
import {existingUpload} from '../forms/formSubmission.js';
import {ehpApplication} from './ehpAccess.js';
import {checkFundingLines} from './ehpFundingPolicy.js';
import {legacyContext,assertLegacyFundingLineMutation} from '../legacyFields.js';
import {writeFundingRow,fundingDates,fundingNumber} from './fundingRepository.js';
const textKeys=['request_type','period_start','period_end','modification_type','modification_justification','scope_of_work_current','scope_of_work_proposed','budget_modification_notes'];
export async function submitFundingRequest(pool,actorId,input,verifyFile=existingUpload) {
  return transaction(pool,async db=>{
    const {actor,application,organization}=await ehpApplication(db,actorId,input.application_id,true);
    if(application.status!=='Approved')throw accountError(409,'Select an approved grant before submitting a request');
    const projectsTable=(await db.query("SELECT to_regclass(current_schema()||'.projects') AS name")).rows[0]?.name;
    const projects=projectsTable?(await db.query('SELECT id,title FROM projects WHERE application_id=$1 AND is_active=true ORDER BY created_date,id',[application.id])).rows:[];
    if(projectsTable&&!projects.length)throw accountError(409,'This application has no active projects');
    const projectId=input.project_id|| (projects.length===1?projects[0].id:null);
    if(projects.length>1&&!projectId)throw accountError(400,'Select a project for this funding request');
    if(projectId&&!projects.some(project=>project.id===projectId))throw accountError(400,'Select a project belonging to this application');
    if(!['Reimbursement','Advance','Modification'].includes(input.request_type))throw accountError(400,'Choose a valid request type');
    if(input.request_type==='Modification'&&!input.modification_type)throw accountError(400,'Choose a modification type');
    fundingDates(input);
    if(!Array.isArray(input.lines)||input.lines.length>500)throw accountError(400,'Provide up to 500 expenditure lines');
    const lines=input.request_type==='Modification'?[]:input.lines.map(line=>({
      budget_category:String(line.budget_category||'Other'),description:String(line.description||'').trim(),expenditure_name:line.expenditure_name||null,quantity:line.quantity??null,unit_cost:line.unit_cost??null,
      amount:line.amount??line.amount_requested,amount_requested:line.amount_requested??line.amount,amount_approved:line.amount_approved??null,amount_paid:line.amount_paid??null,
      amount_match:line.amount_match??0,amount_subgrantee:line.amount_subgrantee??0,ael_number:line.ael_number||null,ael_category:line.ael_category||null,legacy_expenditure_id:line.legacy_expenditure_id||null,
      application_budget_id:line.application_budget_id||null,ehp_affected:line.ehp_affected??null,
      project_id:line.project_id||projectId,vendor:line.vendor||null,reviewer_notes:line.reviewer_notes||null,
    }));
    for(const line of lines)if(line.ehp_affected!==null&&typeof line.ehp_affected!=='boolean')throw accountError(400,'EHP classification must be yes or no');
    await checkFundingLines(db,application,input,lines);
    const {moneyCents}=await import('../forms/valueValidation.js');
    const match=moneyCents(input.match_documented??0);if(match===null)throw accountError(400,'Enter a valid documented match amount');
    const total=lines.reduce((sum,line)=>sum+moneyCents(line.amount_requested??line.amount),0);
    if(!Number.isSafeInteger(total))throw accountError(400,'Requested amount is too large');
    for(const line of lines){const matchCents=moneyCents(line.amount_match??0),subgranteeCents=moneyCents(line.amount_subgrantee??0);if(matchCents===null||matchCents<0)throw accountError(400,'Match amount cannot be negative');if(subgranteeCents===null||subgranteeCents<0)throw accountError(400,'Subgrantee funds cannot be negative');assertLegacyFundingLineMutation(actor,line,await legacyContext(db,actor));if(line.application_budget_id){const budget=(await db.query('SELECT ael_number,ael_category FROM application_budgets WHERE id::text=$1 AND application_id=$2',[line.application_budget_id,application.id])).rows[0];if(budget){if(!line.ael_number)line.ael_number=budget.ael_number||null;if(!line.ael_category)line.ael_category=budget.ael_category||null;}}}
    const submittedAt=new Date();
    const data=Object.fromEntries(textKeys.map(key=>[key,input[key]||null]));
    const saved=await writeFundingRow(db,'funding_requests',null,{...data,project_id:projectId,application_id:application.id,application_number:application.application_number,organization_id:organization.id,organization_name:organization.name,
      submitted_by:actor.email,request_number:await fundingNumber(db),amount_requested:total/100,match_documented:match/100,submitted_at:submittedAt,status:'Submitted',program_code:application.program_code,
      expenditure_rate:application.expenditure_rate,remaining_balance:application.remaining_balance});
    for(const line of lines)await writeFundingRow(db,'funding_request_line_items',null,{...line,funding_request_id:saved.id});
    if(!Array.isArray(input.attachments||[])||(input.attachments||[]).length>100)throw accountError(400,'Provide up to 100 supporting documents');
    for(const document of input.attachments||[]) {
      if(!document.name||!await verifyFile(document.url))throw accountError(422,'A supporting document upload is unavailable. Upload it again.');
      await db.query(`INSERT INTO documents(name,doc_type,file_url,uploaded_by,organization_id,application_id,funding_request_id,review_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,'Pending')`,[document.name,document.docType||'Other',document.url,actor.email,organization.id,application.id,saved.id]);
    }
    await auditForm(db,actor,saved.id,'Submitted','Submitted funding request '+saved.request_number,'FundingRequest');
    await auditForm(db,actor,application.id,'FundingRequestSubmitted','Funding request '+saved.request_number+' submitted','Application');
    const reviewers=(await db.query(`SELECT u.email FROM users u LEFT JOIN grantees g ON g.id::text=u.grantee_id WHERE COALESCE(u.active_status,'active')='active' AND (u.role='isc_admin' OR (u.role IN ('admin','reviewer') AND UPPER(COALESCE(NULLIF(u.scope_state,''),g.state_code,''))=UPPER($1)))`,[organization.state])).rows;
    for(const user of reviewers)await db.query(`INSERT INTO notifications(user_email,title,message,type,entity_type,entity_id,link)
      VALUES($1,'New Funding Request',$2,'fr_submitted','FundingRequest',$3,'/funding-requests')`,[user.email,organization.name+' submitted '+saved.request_number,saved.id]);
    return saved;
  });
}
