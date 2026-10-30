import {defaultForm} from '../../../src/lib/forms/defaultForm.js';
import {accountError,normalizedState,requireAccountAdmin} from '../accountPolicy.js';
import {formActor,formNofo,assertFormAdmin} from './formAccess.js';
export async function formProgram(db,id,lock=false) {
  const result=await db.query('SELECT * FROM grant_programs WHERE id::text=$1'+(lock?' FOR UPDATE':''),[id]);
  if(!result.rows[0])throw accountError(404,'Grant program not found');
  return result.rows[0];
}
export function programFormScope(actor,requested) {
  requireAccountAdmin(actor);
  if(actor.role==='isc_admin') {
    const state=normalizedState(requested);
    if(state&&!/^[A-Z]{2}$/.test(state))throw accountError(400,'Choose a two-letter state code or all states');
    return state;
  }
  const state=normalizedState(actor.scope_state||actor.grantee_state);
  if(!state)throw accountError(403,'Your account needs a state assignment');
  if(requested!==undefined&&normalizedState(requested)!==state)throw accountError(403,'You may configure program defaults for your own state only');
  return state;
}
export async function programVersion(db,programId,state='') {
  return (await db.query('SELECT * FROM grant_program_form_versions WHERE program_id=$1 AND scope_state=$2 ORDER BY version DESC LIMIT 1',[programId,state])).rows[0]||null;
}
export function initialProgramDefinition(program) {
  return defaultForm({program_code:program.code,match_requirement:program.match_requirement});
}
export async function readProgramForm(db,actorId,programId,requestedScope) {
  const actor=await formActor(db,actorId),state=programFormScope(actor,requestedScope),program=await formProgram(db,programId);
  const current=await programVersion(db,program.id,state),inherited=!current&&state?await programVersion(db,program.id,''):null;
  return {...current,id:current?.id||null,program_id:program.id,program_code:program.code,scope_state:state,
    version:current?.version||0,revision:current?.version||0,definition:current?.definition||inherited?.definition||initialProgramDefinition(program),
    inherited_from_version_id:inherited?.id||null,inherited_from_version:inherited?.version||null,can_edit:true,actor_role:actor.role,actor_state:actor.scope_state||actor.grantee_state||''};
}
export async function effectiveProgramForm(db,nofo) {
  let program;
  if(nofo.program_id)program=(await db.query('SELECT * FROM grant_programs WHERE id::text=$1',[nofo.program_id])).rows[0];
  else {
    const matches=(await db.query('SELECT * FROM grant_programs WHERE code=$1 LIMIT 2',[nofo.program_code])).rows;
    if(matches.length===1)program=matches[0];
  }
  if(!program)return {definition:defaultForm(nofo),program_default_version_id:null};
  const states=Array.isArray(nofo.scope_states)?nofo.scope_states:[],state=states.length===1?normalizedState(states[0]):'';
  const version=(state?await programVersion(db,program.id,state):null)||await programVersion(db,program.id,'');
  if(!version)return {definition:defaultForm({...nofo,match_requirement:nofo.match_requirement??program.match_requirement}),program_default_version_id:null};
  const definition=JSON.parse(JSON.stringify(version.definition));
  if(nofo.match_requirement!=null)definition.rules.matchPercent=Number(nofo.match_requirement);
  const docs=defaultForm(nofo).rules.requiredDocuments;
  const combined=new Map((definition.rules.requiredDocuments||[]).map(doc=>[doc.name,doc]));
  docs.forEach(doc=>combined.set(doc.name,doc));definition.rules.requiredDocuments=[...combined.values()];
  return {definition,program_default_version_id:version.id,program_default_scope_state:version.scope_state};
}

export async function readNofoProgramDefaults(db,actorId,nofoId) {
  const actor=await formActor(db,actorId),nofo=await formNofo(db,nofoId);
  assertFormAdmin(actor,nofo);return effectiveProgramForm(db,nofo);
}
