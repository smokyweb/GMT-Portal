import {formNofo,assertFormAdmin} from './formAccess.js';
import {normalizedState,accountError} from '../accountPolicy.js';
const documentRules=value=>JSON.stringify((Array.isArray(value)?value:value?.name?[value]:[]).map(doc=>[doc.name,Boolean(doc.mandatory)]));
export async function validateNofoMutation(db,actor,id,input,method) {
  const data={...input};
  if(data.current_form_version_id!==undefined)throw accountError(400,'Use the Application Form tab to change form versions');
  if(method==='POST') {
    if(!['isc_admin','admin'].includes(actor.role))throw accountError(403,'Administrator access required');
    if(actor.role==='admin') {
      const state=normalizedState(actor.scope_state||actor.grantee_state);
      if(!state)throw accountError(403,'Your administrator account needs a state assignment');
      data.scope_states=[state];
    }data.created_by=actor.email;
  } else {
    const nofo=await formNofo(db,id);assertFormAdmin(actor,nofo);
    const started=Boolean(nofo.current_form_version_id)||(await db.query('SELECT id FROM applications WHERE nofo_id=$1 LIMIT 1',[nofo.id])).rows.length>0;
    if(started&&data.program_code!==undefined&&data.program_code!==nofo.program_code)throw accountError(409,'Create another NOFO to change the grant program after its application form is configured');
    if(started&&data.required_documents!==undefined&&documentRules(data.required_documents)!==documentRules(nofo.required_documents))throw accountError(409,'Change required documents in the Application Form tab so existing applications retain their requirements');
    if(actor.role==='admin'&&data.scope_states!==undefined) {
      const states=data.scope_states,state=normalizedState(actor.scope_state||actor.grantee_state);
      if(!Array.isArray(states)||states.length!==1||normalizedState(states[0])!==state)throw accountError(403,'Keep this NOFO within your assigned state');
    }
  }return data;
}
