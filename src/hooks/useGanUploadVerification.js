import {useEffect,useState} from 'react';
import {ganVerificationPayload} from '@/lib/documents/ganReturnPresentation';
export function useGanUploadVerification(workflow,review) {
  const [form,setForm]=useState({checklist:{},note:''}),[error,setError]=useState('');
  const id=review.submission?.id,accepted=workflow.record.events.find(event=>event.action==='accept_upload'&&event.evidence.submissionId===id),acceptanceId=accepted?.id;
  useEffect(()=>{setForm({checklist:accepted?.evidence.checklist||{},note:accepted?.evidence.note||''});setError('');},[id,acceptanceId]);
  const check=(key,value)=>{setError('');setForm(current=>({...current,checklist:{...current.checklist,[key]:value}}));};
  const note=value=>{setError('');setForm(current=>({...current,note:value}));};
  const act=async returning=>{setError('');try{await workflow.act(returning?'return_upload':'accept_upload',ganVerificationPayload(workflow.record,form,returning));}catch(problem){setError(problem.message);}};
  return {form,error,check,note,accept:()=>act(false),returnCopy:()=>act(true)};
}
