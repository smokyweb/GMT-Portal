import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGanReturnDownloads() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const download=async(row,original=false)=>{setBusy(true);setError('');try{if(original)await base44.ganReturns.downloadOriginal(row);else await base44.ganReturns.downloadSubmission(row);}catch(problem){if(active.current)setError(problem.message);}finally{if(active.current)setBusy(false);}};
  return {busy,error,download};
}
