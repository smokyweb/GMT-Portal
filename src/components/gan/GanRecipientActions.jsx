import {useState} from 'react';
import {useGanReturnForm} from '@/hooks/useGanReturnForm';
import GanSigningMethodChoice from './GanSigningMethodChoice';
import GanSignaturePanel from './GanSignaturePanel';
import GanReturnForm from './GanReturnForm';
import GanReturnStatus from './GanReturnStatus';
export default function GanRecipientActions({workflow}) {
  const record=workflow.record,state=useGanReturnForm(workflow),[method,setMethod]=useState(record.issue.allowed_methods.includes('electronic')?'electronic':'upload');
  if(['Uploaded','Verified'].includes(record.phase))return <GanReturnStatus record={record}/>;
  if(record.phase==='RecipientSigned'||record.phase==='Rejected')return <GanSignaturePanel workflow={workflow}/>;
  const mode=record.phase==='UploadReturned'?'upload':method;
  return <div className="space-y-4">
    {record.returns&&record.phase!=='UploadReturned'&&<GanSigningMethodChoice value={mode} onChange={setMethod} methods={record.issue.allowed_methods} disabled={Boolean(state.busy||workflow.busy)}/>}
    {mode==='upload'&&record.returns?<GanReturnForm workflow={workflow} state={state}/>:<GanSignaturePanel workflow={workflow}/>}
    {mode==='upload'&&record.phase==='Reviewed'&&<GanSignaturePanel workflow={workflow} rejectOnly/>}
  </div>;
}
