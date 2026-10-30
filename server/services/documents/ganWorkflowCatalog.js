import {accountError,normalizedState} from '../accountPolicy.js';
import {formActor} from '../forms/formAccess.js';
import {readGanWorkflow} from './ganWorkflowRead.js';
export async function listGanWorkflows(db,actorId) {
  const actor=await formActor(db,actorId),admin=['admin','isc_admin','reviewer'].includes(actor.role);
  if(!admin&&actor.role!=='user')throw accountError(403,'Award documents are available to assigned administrators and recipients');
  const candidates=(await db.query(`SELECT DISTINCT d.id,MAX(i.issued_at) AS issued_at FROM generated_documents d
    JOIN applications a ON a.id::text=d.application_id JOIN organizations o ON o.id::text=a.organization_id
    JOIN gan_workflow_issues i ON i.document_id=d.id
    WHERE d.gan_managed AND ($1='isc_admin'
      OR ($1 IN ('admin','reviewer') AND upper(trim(o.state))=$2 AND ($3::text IS NULL OR d.gan_grantee_id::text=$3))
      OR ($1='user' AND i.recipient_id::text=$4 AND i.organization_id::text=$5))
    GROUP BY d.id ORDER BY issued_at DESC,d.id`,[actor.role,normalizedState(actor.scope_state||actor.grantee_state),actor.grantee_id||null,actor.id,actor.organization_id||null])).rows;
  const documents=[];
  for(const candidate of candidates){
    let state;try{state=await readGanWorkflow(db,actor.id,candidate.id);}catch(error){if(error.status===403)continue;throw error;}
    if(!state.issue)continue;
    documents.push({id:state.document.id,applicationNumber:state.manifest.values.application_number,subawardNumber:state.manifest.values.subaward_number,
      organizationName:state.manifest.values.organization_name,projectIds:state.manifest.projects.map(project=>project.project_id),
      phase:state.phase,issuedAt:state.issue.issued_at,recipientName:state.issue.recipient_name,canAct:state.canAct,fullyExecuted:false});
  }
  return {documents};
}
