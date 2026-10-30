import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ganReturnPageNumbers,ganReturnSubmitPayload,ganReturnMissing} from '@/lib/documents/ganReturnPresentation';
export function useGanReturnForm(workflow) {
  const [form,setForm]=useState({name:'',title:'',signedDate:'',confirmed:false}),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef(null),active=useRef(true),record=workflow.record;
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{setForm(current=>({...current,confirmed:false}));request.current=null;},[record.phase]);
  const change=(key,value)=>{setError('');setForm(current=>({...current,[key]:value}));};
  const upload=async(kind,file,pagesText)=>{
    setError('');setNotice('');if(!file){setError('Choose a signed PDF first.');return false;}setBusy('Uploading signed pages…');
    try{
      const sourcePages=ganReturnPageNumbers(pagesText),key=JSON.stringify({kind,sourcePages,revision:record.revision});
      if(request.current?.key!==key||request.current.file!==file)request.current={key,file,input:{requestId:crypto.randomUUID(),expectedRevision:record.revision,kind,sourcePages}};
      await base44.ganReturns.upload(record.document.id,request.current.input,file);await workflow.refresh();
      if(!active.current)return false;request.current=null;setForm(current=>({...current,confirmed:false}));setNotice('Private upload saved. Submit the completed set when every required page is present.');return true;
    }catch(problem){if(active.current)setError(problem.message);return false;}finally{if(active.current)setBusy('');}
  };
  const submit=async()=>{setError('');try{await workflow.act('submit_upload',ganReturnSubmitPayload(form,record));}catch(problem){setError(problem.message);}};
  const download=async upload=>{setError('');setBusy('Downloading original…');try{await base44.ganReturns.downloadOriginal(upload);}catch(problem){if(active.current)setError(problem.message);}finally{if(active.current)setBusy('');}};
  return {form,change,upload,submit,download,busy,error,notice,missing:ganReturnMissing(record.returns)};
}
