import {accountError} from '../accountPolicy.js';
import {ownedGanBatch} from './ganBatchAccess.js';
import {ganBatchRunOptions} from './ganBatchPolicy.js';
import {readGanBatch} from './ganBatchRead.js';
import {saveGanDraft} from './ganDrafts.js';
import {saveGanBatchResult} from './ganBatchResult.js';
import {ganBatchRetryPass} from './ganBatchRetry.js';
const missingOfficial=row=>Object.assign(accountError(422,'Select a registered authorized official for this organization'),{details:[{token:'authorized_official_email',reason:'Select a registered authorized official',source:{record:'Organization',id:row.organizationId,field:'authorized_official_id',screen:'Organization › Authorized Official'}}]});
export async function runGanBatch(pool,actorId,batchId,input={},ip='') {
  const options=ganBatchRunOptions(input),lock=await pool.connect();let locked=false;
  try {
    const initial=await ownedGanBatch(lock,actorId,batchId);
    locked=(await lock.query("SELECT pg_try_advisory_lock(hashtext(current_schema()||':gan-batch:'||$1)) AS locked",[batchId])).rows[0].locked;
    if(!locked)throw accountError(409,'This batch is already running. Refresh its progress before resuming.');
    const {batch}=initial;
    const pass=options.retryBlocked?await ganBatchRetryPass(pool,batch,initial.actor,options.retryRequestId,ip):null;
    const before=await readGanBatch(lock,actorId,batchId),targets=pass?new Map(pass.rows.map(row=>[row.applicationId,row.attempts])):null;
    const eligible=before.rows.filter(row=>row.result.state==='Pending'&&!pass||pass&&targets.has(row.applicationId)&&row.result.state!=='Generated'&&row.result.attempts<=targets.get(row.applicationId));
    let processed=0;
    for(const row of eligible.slice(0,options.limit)) {
      const {actor}=await ownedGanBatch(lock,actorId,batchId);
      let result;
      try {
        const official=batch.selection.officialsByOrganization[row.organizationId];
        if(!official)throw missingOfficial(row);
        const {officialsByOrganization,...selection}=batch.selection;void officialsByOrganization;
        const saved=await saveGanDraft(pool,actorId,row.applicationId,{...selection,...(row.granteeId?{granteeId:row.granteeId}:{}),authorizedOfficialId:official,expectedRevision:row.expectedRevision,requestId:row.requestId},ip,
          {nofoId:batch.nofo_id,organizationId:row.organizationId,nofoRevision:batch.nofo_revision,templateVersion:batch.template_version,templateSha256:batch.template_sha256,organizationSettingsRevision:row.organizationSettingsRevision,granteeSettingsRevision:row.granteeSettingsRevision});
        result={state:'Generated',document:saved.document,replayed:saved.replayed};
      }catch(error) {
        if(error.status===401)throw error;
        const known=error.status>=400&&error.status<500;
        result={state:known?'Blocked':'Failed',reason:known?error.message:'A server error prevented this row. Retry after the service recovers.',details:known?error.details||[]:[]};
      }
      // A failed progress/audit write stops this request. A retry safely replays an already committed draft.
      await saveGanBatchResult(pool,actor,batchId,row,result,ip);processed++;
    }
    const progress=await readGanBatch(lock,actorId,batchId);
    const remaining=pass?progress.rows.filter(row=>targets.has(row.applicationId)&&row.result.state!=='Generated'&&row.result.attempts<=targets.get(row.applicationId)).length:progress.counts.pending;
    return {...progress,run:{processed,remaining,retryRequestId:pass?.id||null}};
  }finally{
    try{if(locked)await lock.query("SELECT pg_advisory_unlock(hashtext(current_schema()||':gan-batch:'||$1))",[batchId]);}finally{lock.release();}
  }
}
