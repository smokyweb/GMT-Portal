import {randomUUID} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {ganBatchRequest} from './ganBatchPolicy.js';
import {ganBatchActor} from './ganBatchAccess.js';
import {ganBatchCandidates} from './ganBatchCandidates.js';
import {previewGanFromRecords} from './ganContext.js';
import {renderGanPdfPreview} from './ganPdfPreview.js';
export async function previewGanBatchRows(pool,actorId,input) {
  const {input:request,selection}=ganBatchRequest({...input,requestId:input?.requestId||randomUUID()});
  if(!request.applicationIds||request.applicationIds.length>25)throw accountError(400,'Check one through 25 selected applications per readiness request');
  const {actor,nofo,state}=await ganBatchActor(pool,actorId,request.nofoId),candidates=new Map((await ganBatchCandidates(pool,actor,nofo,state)).map(row=>[row.applicationId,row]));
  if(request.applicationIds.some(id=>!candidates.has(id)))throw accountError(403,'A selected application is outside this NOFO or your assigned state');
  const rows=[];
  for(const id of request.applicationIds) {
    const row=candidates.get(id);
    try {
      const preview=await previewGanFromRecords(pool,actorId,id,{templateId:selection.templateId,granteeId:selection.granteeId,authorizedOfficialId:Object.hasOwn(selection.officialsByOrganization,row.organizationId)?selection.officialsByOrganization[row.organizationId]:undefined,awardDate:selection.awardDate,dueDate:selection.dueDate});
      if(preview.ready)renderGanPdfPreview(preview,{programCode:preview.values.program_code,templateBody:preview.template.body,templateVersion:preview.template.version});
      rows.push({...row,projectCount:preview.projects.length,ready:preview.ready,issues:preview.issues});
    }catch(error) {
      if(error.status===401)throw error;
      if(!error.status)throw error;
      rows.push({...row,ready:false,issues:[{reason:error.message,source:{record:'Application',id,field:'readiness',screen:'Applications › Review'}}]});
    }
  }
  return {rows,previewOnly:true,readyForSending:false};
}
