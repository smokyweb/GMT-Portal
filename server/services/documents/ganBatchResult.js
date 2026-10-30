import {transaction} from '../accountRepository.js';
import {auditForm} from '../forms/formAccess.js';
export async function saveGanBatchResult(pool,actor,batchId,row,result,ip='') {
  return transaction(pool,async db=>{
    await db.query("SELECT set_config('gmt.gan_action','batch-result',true)");
    const saved=(await db.query(`INSERT INTO gan_draft_batch_results(batch_id,application_id,state,document_id,revision,pdf_sha256,replayed,reason,details,attempts,award_amount,project_count)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11) ON CONFLICT(batch_id,application_id) DO UPDATE SET
      state=EXCLUDED.state,document_id=EXCLUDED.document_id,revision=EXCLUDED.revision,pdf_sha256=EXCLUDED.pdf_sha256,replayed=EXCLUDED.replayed,
      reason=EXCLUDED.reason,details=EXCLUDED.details,award_amount=EXCLUDED.award_amount,project_count=EXCLUDED.project_count,attempts=gan_draft_batch_results.attempts+1,updated_at=NOW() RETURNING *`,
      [batchId,row.applicationId,result.state,result.document?.id||null,result.document?.revision||null,result.document?.pdf_sha256||null,Boolean(result.replayed),result.reason||null,JSON.stringify(result.details||[]),result.document?.awarded_amount||null,result.document?.project_count??null])).rows[0];
    await auditForm(db,actor,batchId,'GANBatchRow'+result.state,'Application '+(row.applicationNumber||row.applicationId)+'; attempt '+saved.attempts+(result.reason?'; '+String(result.reason).slice(0,500):'')+(ip?' IP: '+String(ip).slice(0,100):''),'GeneratedDocument');
    return saved;
  });
}
