import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useEhpReview(id) {
  const [context,setContext]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [reference,setReference]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[notes,setNotes]=useState('');
  useEffect(()=>{let active=true;setContext(null);setError('');
    base44.ehp.application(id).then(value=>{if(active)setContext(value);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};
  },[id]);
  const run=async action=>{setBusy(true);setError('');try{const value=await action();setContext(value);return value.application;}catch(err){setError(err.message);return null;}finally{setBusy(false);}};
  return {context,busy,error,reference,setReference,date,setDate,notes,setNotes,
    classify:(lineId,affected)=>run(()=>base44.ehp.classify(id,lineId,affected,context.application.ehp_review_revision)),
    decide:decision=>run(()=>base44.ehp.decide(id,{decision,reference,date,notes,expectedRevision:context.application.ehp_review_revision}))};
}
