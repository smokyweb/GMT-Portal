import {accountError,normalizedState} from '../accountPolicy.js';
import {formActor,assertNofoAccess} from '../forms/formAccess.js';
export async function ganBatchActor(db,actorId,nofoId) {
  const actor=await formActor(db,actorId);
  if(!['admin','isc_admin'].includes(actor.role))throw accountError(403,'An assigned administrator must generate GAN batches');
  const nofo=(await db.query('SELECT * FROM nofos WHERE id::text=$1',[nofoId])).rows[0];
  if(!nofo)throw accountError(404,'NOFO not found');
  const state=normalizedState(actor.scope_state||actor.grantee_state);
  if(actor.role!=='isc_admin'&&!state)throw accountError(403,'Your administrator account needs a state assignment');
  assertNofoAccess(actor,nofo,{state});
  return {actor,nofo,state};
}
export async function ownedGanBatch(db,actorId,batchId) {
  const batch=(await db.query('SELECT * FROM gan_draft_batches WHERE id::text=$1',[batchId])).rows[0];
  if(!batch)throw accountError(404,'GAN batch not found');
  const access=await ganBatchActor(db,actorId,batch.nofo_id);
  if(batch.actor_id!==access.actor.id)throw accountError(403,'Only the initiating administrator can access or resume this batch');
  return {...access,batch};
}
