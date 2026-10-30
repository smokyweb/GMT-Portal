const money=value=>String(value??'').startsWith('$')?value:value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
export function ganBatchRows(rows,checks,selectedIds) {
  const selected=new Set(selectedIds);
  return rows.map(row=>{
    const check=checks[row.applicationId],result=row.result,issues=result?.details?.length?result.details:check?.issues||[];
    const checkBlocked=check?.issues?.some(issue=>['ApplicationBudget','Project'].includes(issue.source?.record)||['status','readiness'].includes(issue.source?.field));
    const state=result?.state==='Generated'?'Draft saved':result?.state==='Blocked'?'Blocked':result?.state==='Failed'?'Retry needed':check?(check.ready?'Ready':checkBlocked?'Blocked':'Missing fields'):'Not checked';
    return {...row,selected:selected.has(row.applicationId),state,issues,reason:result?.reason||'',awardLabel:money(result?.award_amount||row.awardedAmount),
      projectLabel:String(result?.project_count||row.projectCount||1)+' '+((result?.project_count||row.projectCount||1)===1?'project':'projects'),
      pdfDocument:result?.state==='Generated'?{id:result.document_id,revision:result.revision}:null};
  });
}
export const ganSourceHref=record=>({Nofo:'/nofos',GrantProgram:'/grant-programs',Organization:'/organizations',User:'/admin',Grantee:'/admin-hub',Template:'/document-templates',AwardDetails:'/applications',Application:'/applications',ApplicationBudget:'/applications',Project:'/applications'}[record]||'/applications');
export function newGanBatchSelection() {return {nofoId:'',templateId:'',granteeId:'',awardDate:new Date().toISOString().slice(0,10),dueDate:'',officialsByOrganization:{}};}
export function ganBatchPayload(selection,selectedIds,requestId) {
  return {...selection,granteeId:selection.granteeId||undefined,requestId,applicationIds:selectedIds,...(!selection.dueDate?{dueDate:undefined}:{})};
}

export function presentGanCatalog(data) {
  return {...data,templates:data.templates.map(item=>({...item,label:item.name+' · v'+item.version})),
    batches:(data.batches||[]).map(item=>({...item,label:new Date(item.created_at).toLocaleString()+' · '+item.generated+'/'+item.total+' saved · v'+item.template_version})),
    organizations:data.organizations.map(org=>({...org,officialOptions:data.officials.filter(user=>user.organization_id===org.id).map(user=>({...user,label:(user.full_name||user.email)+(user.title?' · '+user.title:'')}))}))};
}

export function sharedGanIssues(rows) {
  const issues=rows.flatMap(row=>row.issues).filter(issue=>['Nofo','GrantProgram','Template'].includes(issue.source?.record));
  return [...new Map(issues.map(issue=>[[issue.source.record,issue.source.id,issue.source.field,issue.reason].join('|'),issue])).values()];
}

export function ganIssueLabel(issue) {
  const names={federal_award_number:'Federal award number (FAIN)',cfda_number:'Assistance Listing / CFDA number',organization_tax_id:'EIN',budget_total:'POETE federal budget',match_total:'Match allocation',award_record:'Award record'};
  return names[issue.token]||String(issue.source?.field||issue.token||'Source field').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
}
