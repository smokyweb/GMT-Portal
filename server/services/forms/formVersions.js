import {legacyForm} from '../../../src/lib/forms/legacyForm.js';
import {pinExistingApplications} from './existingFormSnapshots.js';
import {randomUUID} from 'node:crypto';
import {effectiveProgramForm} from './programFormDefaults.js';
import {accountError} from '../accountPolicy.js';
import {transaction} from '../accountRepository.js';
import {validateDefinition} from './definitionPolicy.js';
import {formActor,formNofo,assertFormAdmin,assertNofoAccess,auditForm} from './formAccess.js';
export async function currentForm(db,nofo) {
  if(nofo.current_form_version_id) {
    const result=await db.query('SELECT * FROM nofo_form_versions WHERE id=$1 AND nofo_id=$2',[nofo.current_form_version_id,nofo.id]);
    if(!result.rows[0])throw accountError(409,'The current form version is unavailable');
    return result.rows[0];
  }
  return {id:null,nofo_id:nofo.id,version:0,revision:0,locked_at:null,...await effectiveProgramForm(db,nofo)};
}
async function insertVersion(db,nofo,definition,actor,locked=false,programDefaultId=null) {
  const version=Number((await db.query('SELECT COALESCE(MAX(version),0)+1 AS next FROM nofo_form_versions WHERE nofo_id=$1',[nofo.id])).rows[0].next);
  const result=await db.query(`INSERT INTO nofo_form_versions(id,nofo_id,version,definition,created_by,locked_at,program_default_version_id)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[randomUUID(),nofo.id,version,JSON.stringify(definition),actor.email,locked?new Date():null,programDefaultId]);
  await db.query('UPDATE nofos SET current_form_version_id=$2 WHERE id=$1',[nofo.id,result.rows[0].id]);
  return result.rows[0];
}
export async function ensurePinnedForm(db,nofo,actor) {
  let version=await currentForm(db,nofo);
  if(!version.id)version=await insertVersion(db,nofo,validateDefinition(version.definition,nofo),actor,false,version.program_default_version_id);
  if(!version.locked_at)version=(await db.query('UPDATE nofo_form_versions SET locked_at=NOW() WHERE id=$1 RETURNING *',[version.id])).rows[0];
  return version;
}
export async function readNofoForm(db,actorId,nofoId) {
  const actor=await formActor(db,actorId),nofo=await formNofo(db,nofoId);
  assertNofoAccess(actor,nofo,undefined,actor.role==='user');
  let canEdit=true;try{assertFormAdmin(actor,nofo);}catch{canEdit=false;}
  return {...await currentForm(db,nofo),can_edit:canEdit,actor_role:actor.role,actor_state:actor.scope_state||actor.grantee_state||''};
}
export async function saveNofoForm(pool,actorId,nofoId,input) {
  return transaction(pool,async db=>{
    const actor=await formActor(db,actorId),nofo=await formNofo(db,nofoId,true);
    assertFormAdmin(actor,nofo);
    let previous=await currentForm(db,nofo);
    if((input.expectedVersionId||null)!==previous.id||input.expectedRevision!==previous.revision)throw accountError(409,'The form changed since you opened it. Reload before saving.');
    if(!previous.id&&(input.expectedProgramDefaultId||null)!==(previous.program_default_version_id||null))throw accountError(409,'The inherited program defaults changed. Reload before saving this NOFO form.');
    const definition=validateDefinition(input.definition,nofo);delete definition.legacy;
    let originId=previous.program_default_version_id||null;
    if(Object.hasOwn(input,'appliedProgramDefaultId')){const current=await effectiveProgramForm(db,nofo);if((current.program_default_version_id||null)!==(input.appliedProgramDefaultId||null))throw accountError(409,'Program defaults changed. Reload them before applying.');originId=current.program_default_version_id||null;}
    if(!previous.id) {
      const exists=(await db.query('SELECT id FROM applications WHERE nofo_id=$1 AND form_version_id IS NULL LIMIT 1',[nofo.id])).rows.length;
      if(exists) {
        previous=(await pinExistingApplications(db,nofo,actor,previous.program_default_version_id?previous.definition:legacyForm(nofo),previous.program_default_version_id)).version;
      }
    }
    let saved;
    if(previous.id&&!previous.locked_at) {
      saved=(await db.query(`UPDATE nofo_form_versions SET definition=$2,program_default_version_id=$3,revision=revision+1,updated_date=NOW() WHERE id=$1 RETURNING *`,[previous.id,JSON.stringify(definition),originId])).rows[0];
    } else saved=await insertVersion(db,nofo,definition,actor,false,originId);
    await auditForm(db,actor,nofo.id,'ApplicationFormSaved','Saved application form version '+saved.version+' revision '+saved.revision+(previous.locked_at?'; existing applications retain their locked version':''));
    return saved;
  });
}
