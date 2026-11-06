import {base44} from '@/api/base44Client';
export async function submitFunding(form,lineItems,attachments) {
  if(!form.application_id)throw new Error('Select a grant before submitting');
  if(!form.project_id)throw new Error('Select a project before submitting');
  if(attachments.some(item=>item.uploading||!item.url))throw new Error('Complete supporting document uploads before submitting');
  return base44.ehp.submitFunding({...form,
    project_id:form.project_id,lines:lineItems.map(line=>({project_id:line.project_id||form.project_id,budget_category:line.budget_category,description:line.description||line.expenditure_name||'',expenditure_name:line.expenditure_name||null,
      amount:Math.max(0,Number(line.amount)||0),amount_requested:Math.max(0,Number(line.amount_requested??line.amount)||0),amount_match:Math.max(0,Number(line.amount_match)||0),amount_subgrantee:Math.max(0,Number(line.amount_subgrantee)||0),quantity:line.quantity===''?null:Number(line.quantity)||null,unit_cost:line.unit_cost===''?null:Number(line.unit_cost)||null,ael_number:line.ael_number||null,ael_category:line.ael_category||null,legacy_expenditure_id:line.legacy_expenditure_id||null,application_budget_id:line.application_budget_id||null,ehp_affected:line.ehp_affected??null,
      vendor:line.item_manufacturer||null,reviewer_notes:line.item_detail_description||null})),
    attachments:attachments.map(({name,url,docType})=>({name,url,docType})),
  });
}

export function fundingSubmissionError(error) {
  return (error.data?.details||[]).map(item=>item.message).join(' · ')||error.message||'Failed to submit funding request';
}
