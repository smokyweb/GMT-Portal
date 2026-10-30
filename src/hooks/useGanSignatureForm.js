import {useState} from 'react';
import {ganSignaturePayload} from '@/lib/documents/ganWorkflowPresentation';
export function useGanSignatureForm(workflow) {
  const [form,setForm]=useState({name:'',title:'',electronic:false,conditions:false,authority:false}),[rejecting,setRejecting]=useState(false),[note,setNote]=useState(''),[error,setError]=useState('');
  const change=(key,value)=>{setError('');setForm(current=>({...current,[key]:value}));};
  const sign=async()=>{setError('');try{await workflow.act('sign',ganSignaturePayload(form,workflow.record.issue));}catch(problem){setError(problem.message);}};
  const reject=async()=>{setError('');if(!note.trim()){setError('Explain what needs to change before rejecting this award.');return;}if(await workflow.act('reject',{note}))setRejecting(false);};
  return {form,change,rejecting,setRejecting,note,setNote,error,sign,reject};
}
