import {ownedGanBatch} from './ganBatchAccess.js';
export async function readGanBatch(db,actorId,id) {
  const {batch}=await ownedGanBatch(db,actorId,id);
  const saved=new Map((await db.query('SELECT * FROM gan_draft_batch_results WHERE batch_id=$1',[batch.id])).rows.map(row=>[row.application_id,row]));
  const rows=batch.rows.map(row=>({...row,...(saved.has(row.applicationId)?{result:saved.get(row.applicationId)}:{result:{state:'Pending',attempts:0}})}));
  const counts={total:rows.length,pending:0,generated:0,blocked:0,failed:0};
  for(const row of rows)counts[row.result.state.toLowerCase()]++;
  return {id:batch.id,nofoId:batch.nofo_id,createdAt:batch.created_at,templateId:batch.template_id,templateVersion:batch.template_version,templateSha256:batch.template_sha256,
    selection:batch.selection,counts,status:counts.pending?'Pending':counts.blocked||counts.failed?'CompletedWithIssues':'Completed',rows,previewOnly:true,readyForSending:false};
}
