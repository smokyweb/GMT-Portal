import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGanReturnReview(record) {
  const submission=record?.returns?.submissions[0]||null,id=submission?.id;
  const [view,setView]=useState('issued'),[url,setUrl]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[rendered,setRendered]=useState(false);
  const blob=useRef(''),generation=useRef(0);
  useEffect(()=>{generation.current++;setView('issued');setUrl('');setBusy('');setError('');setRendered(false);if(blob.current)URL.revokeObjectURL(blob.current);blob.current='';return()=>{generation.current++;if(blob.current)URL.revokeObjectURL(blob.current);};},[id]);
  const load=async()=>{
    const version=++generation.current;setView('uploaded');setBusy('Loading signed submission…');setError('');setRendered(false);setUrl('');if(blob.current)URL.revokeObjectURL(blob.current);blob.current='';
    try{const pdf=await base44.ganReturns.pdf(submission);if(version!==generation.current)return;blob.current=URL.createObjectURL(pdf);setUrl(blob.current);}catch(problem){if(version===generation.current)setError(problem.message);}finally{if(version===generation.current)setBusy('');}
  };
  const choose=value=>{setView(value);if(value==='uploaded'&&!url&&!busy)load();};
  const download=async()=>{const version=generation.current;setError('');setBusy('Downloading signed submission…');try{await base44.ganReturns.downloadSubmission(submission);}catch(problem){if(version===generation.current)setError(problem.message);}finally{if(version===generation.current)setBusy('');}};
  return {submission,view,choose,url,busy,error,rendered,setRendered,load,download};
}
