import {ganReturnActionNotice} from '@/lib/documents/ganReturnPresentation';
import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGanWorkflow(documentId) {
  const [record,setRecord]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[previewUrl,setPreviewUrl]=useState(''),[rendered,setRendered]=useState(false);
  const blob=useRef(''),request=useRef(null),generation=useRef(0);
  const current=version=>generation.current===version;
  const clearPdf=()=>{if(blob.current)URL.revokeObjectURL(blob.current);blob.current='';setPreviewUrl('');setRendered(false);};
  const refresh=async(version=generation.current)=>{const next=await base44.ganWorkflow.read(documentId);if(current(version))setRecord(next);return next;};
  const loadPdf=async(state,version=generation.current)=>{
    if(!current(version))return;clearPdf();const pdf=await base44.ganWorkflow.pdf(state.issue.id),next=await refresh(version);
    if(!current(version))return next;
    blob.current=URL.createObjectURL(pdf);setPreviewUrl(blob.current);return next;
  };
  useEffect(()=>{const version=++generation.current;clearPdf();setBusy('Loading award…');setError('');setRecord(null);setNotice('');request.current=null;
    (async()=>{try{const next=await refresh(version);if(next.issue)await loadPdf(next,version);}catch(problem){if(current(version))setError(problem.message);}finally{if(current(version))setBusy('');}})();
    return()=>{generation.current++;if(blob.current)URL.revokeObjectURL(blob.current);};
  },[documentId]);
  const act=async(action,extra={})=>{
    const version=generation.current;setBusy('Saving '+action+'…');setError('');setNotice('');
    try {
      const input={expectedRevision:record.revision,...extra},key=JSON.stringify({action,input});
      if(request.current?.key!==key)request.current={key,input:{requestId:crypto.randomUUID(),...input}};
      await base44.ganWorkflow.act(documentId,action,request.current.input);
      const next=await refresh(version);if(!current(version))return false;request.current=null;
      if(action==='sign')await loadPdf(next,version);
      if(current(version))setNotice(ganReturnActionNotice(action)||(action==='sign'?'Your signature was recorded. NEMA verification and countersignature are still required.':action==='reject'?'Rejection saved. The issuing team can review your note.':'GAN issued for signature. Email delivery has not been verified.'));
      return current(version);
    }catch(problem){if(current(version))setError(problem.message);return false;}finally{if(current(version))setBusy('');}
  };
  const preview=async()=>{const version=generation.current;setBusy('Loading PDF…');setError('');try{await loadPdf(await refresh(version),version);}catch(problem){if(current(version))setError(problem.message);}finally{if(current(version))setBusy('');}};
  const download=async()=>{const version=generation.current;setBusy('Downloading PDF…');setError('');try{await base44.ganWorkflow.download(record.issue.id);await refresh(version);}catch(problem){if(current(version))setError(problem.message);}finally{if(current(version))setBusy('');}};
  return {record,busy,error,notice,previewUrl,rendered,setRendered,act,preview,download,refresh};
}
