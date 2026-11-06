import {base44} from '@/api/base44Client';
export async function submitFundingCsv(applicationId,form,rows) {
  return base44.ehp.submitFunding({...form,application_id:applicationId,request_type:'Reimbursement',
    lines:rows.map(row=>({budget_category:row.budget_category,description:row.description,amount_requested:row.amount,
      application_budget_id:row.application_budget_id||null,amount_match:Math.max(0,Number(row.amount_match)||0),ael_number:row.ael_number||null,ael_category:row.ael_category||null,legacy_expenditure_id:row.legacy_expenditure_id||null,ehp_affected:row.ehp_affected===true||row.ehp_affected==='true'?true:row.ehp_affected===false||row.ehp_affected==='false'?false:null})),
    attachments:[],
  });
}
