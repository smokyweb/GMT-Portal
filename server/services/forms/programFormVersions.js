import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {transaction} from '../accountRepository.js';
import {formActor,auditForm} from './formAccess.js';
import {validateDefinition} from './definitionPolicy.js';
import {currentForm} from './formVersions.js';
import {pinExistingApplications} from './existingFormSnapshots.js';
import {legacyForm} from '../../../src/lib/forms/legacyForm.js';
import {formProgram,programFormScope,programVersion} from './programFormDefaults.js';
async function preserveStartedForms(db,program,state,actor) {
  const unique=(await db.query('SELECT COUNT(*)::int count FROM grant_programs WHERE code=$1',[program.code])).rows[0].count===1;
  const nofos=(await db.query(`SELECT * FROM nofos WHERE (program_id=$1 OR ($3::boolean AND NULLIF(program_id,'') IS NULL AND program_code=$2))
    AND ($4='' OR (jsonb_array_length(scope_states)=1 AND UPPER(scope_states->>0)=$4)) ORDER BY id FOR UPDATE`,[program.id,program.code,unique,state])).rows;
  let pinned=0;
  for(const nofo of nofos) {
    const legacy=(await db.query('SELECT id FROM applications WHERE nofo_id=$1 AND form_version_id IS NULL LIMIT 1',[nofo.id])).rows.length;
    if(!legacy)continue;
    const current=await currentForm(db,nofo);
    const result=await pinExistingApplications(db,nofo,actor,current.program_default_version_id?current.definition:legacyForm(nofo),current.program_default_version_id);
    pinned+=result.count;
  }
  return pinned;
}
export async function saveProgramForm(pool,actorId,programId,input) {
  return transaction(pool,async db=>{
    const actor=await formActor(db,actorId),state=programFormScope(actor,input.scope_state),program=await formProgram(db,programId,true);
    const previous=await programVersion(db,program.id,state),inherited=!previous&&state?await programVersion(db,program.id,''):null;
    if((input.expectedVersionId||null)!==(previous?.id||null)||input.expectedRevision!==(previous?.version||0)||
      (input.expectedInheritedVersionId||null)!==(inherited?.id||null))throw accountError(409,'Program defaults changed since you opened them. Reload before saving.');
    const definition=validateDefinition(input.definition,{program_code:program.code,match_requirement:program.match_requirement});
    delete definition.legacy;
    const pinned=await preserveStartedForms(db,program,state,actor);
    const version=(previous?.version||0)+1;
    const saved=(await db.query(`INSERT INTO grant_program_form_versions(id,program_id,scope_state,version,definition,created_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[randomUUID(),program.id,state,version,JSON.stringify(definition),actor.email])).rows[0];
    await auditForm(db,actor,program.id,'ProgramApplicationDefaultsSaved','Saved '+(state||'all-state')+' application defaults version '+version+'; preserved '+pinned+' existing application(s)','GrantProgram');
    return {...saved,program_code:program.code,revision:version,inherited_from_version_id:null,can_edit:true};
  });
}
