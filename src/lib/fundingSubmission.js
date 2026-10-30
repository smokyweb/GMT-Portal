import {base44} from '@/api/base44Client';
export async function submitFunding(form,lineItems,attachments) {
  if(!form.application_id)throw new Error('Select a grant before submitting');
  if(attachments.some(item=>item.uploading||!item.url))throw new Error('Complete supporting document uploads before submitting');
  return base44.ehp.submitFunding({...form,
    lines:lineItems.map(line=>({budget_category:line.budget_category,description:line.description||line.expenditure_name||'',
      amount_requested:line.amount,application_budget_id:line.application_budget_id||null,ehp_affected:line.ehp_affected??null,
      vendor:line.item_manufacturer||null,reviewer_notes:line.item_detail_description||null})),
    attachments:attachments.map(({name,url,docType})=>({name,url,docType})),
  });
}

export function fundingSubmissionError(error) {
  return (error.data?.details||[]).map(item=>item.message).join(' · ')||error.message||'Failed to submit funding request';
}
