import {transaction} from '../accountRepository.js';
import {accountError} from '../accountPolicy.js';
import {auditForm} from '../forms/formAccess.js';
export async function ganBatchRetryPass(pool,batch,actor,id,ip='') {
  return transaction(pool,async db=>{
    const previous=(await db.query('SELECT * FROM gan_draft_batch_retry_passes WHERE id=$1',[id])).rows[0];
    if(previous) {
      if(previous.batch_id!==batch.id||previous.actor_id!==actor.id)throw accountError(409,'This retry request ID belongs to another batch');
      return previous;
    }
    const results=new Map((await db.query('SELECT application_id,state,attempts FROM gan_draft_batch_results WHERE batch_id=$1',[batch.id])).rows.map(row=>[row.application_id,row]));
    const rows=batch.rows.filter(row=>results.get(row.applicationId)?.state!=='Generated').map(row=>({applicationId:row.applicationId,attempts:results.get(row.applicationId)?.attempts||0}));
    await db.query("SELECT set_config('gmt.gan_action','batch-plan',true)");
    const saved=(await db.query('INSERT INTO gan_draft_batch_retry_passes(id,batch_id,actor_id,rows) VALUES($1,$2,$3,$4) RETURNING *',[id,batch.id,actor.id,JSON.stringify(rows)])).rows[0];
    await auditForm(db,actor,batch.id,'GANBatchRetryPlanned','Planned retry of '+rows.length+' unresolved rows'+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocument');
    return saved;
  });
}
