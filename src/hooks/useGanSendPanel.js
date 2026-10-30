import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGanSendPanel(documentId,packageId) {
  const [check,setCheck]=useState(null),[record,setRecord]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[issues,setIssues]=useState([]);
  const request=useRef(null);
  const refresh=async()=>{const next=await base44.ganWorkflow.read(documentId);setRecord(next);return next;};
  useEffect(()=>{let active=true;setCheck(null);setRecord(null);setError('');setIssues([]);setReviewed(false);request.current=null;setBusy('Checking current source records…');
    (async()=>{try{
      const current=await base44.ganWorkflow.read(documentId);if(!active)return;setRecord(current);
      if(current.phase==='Draft'){const ready=await base44.ganWorkflow.readiness(documentId,packageId);if(active)setCheck(ready);}
    }catch(problem){if(active){setError(problem.message);setIssues(problem.data?.details||[]);}}finally{if(active)setBusy('');}})();
    return()=>{active=false;};
  },[documentId,packageId]);
  const send=async()=>{
    setBusy('Issuing GAN…');setError('');
    try{if(!request.current)request.current={requestId:crypto.randomUUID(),expectedRevision:record.revision,packageId};
      await base44.ganWorkflow.act(documentId,'send',request.current);await refresh();request.current=null;
    }catch(problem){setError(problem.message);}finally{setBusy('');}
  };
  return {check,record,busy,error,issues,reviewed,setReviewed,send};
}
