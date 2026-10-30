import {useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ganSignaturePages} from '@/lib/documents/ganPackagePresentation';
export function useGanAttachmentUpload(nofoId,onUploaded) {
  const [kind,setKind]=useState('special_conditions'),[title,setTitle]=useState(''),[pages,setPages]=useState(''),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reset,setReset]=useState(0);
  const request=useRef(null);
  const change=(key,value)=>{request.current=null;setError('');({kind:setKind,title:setTitle,pages:setPages,file:setFile}[key])(value);};
  const upload=async()=>{
    setBusy(true);setError('');
    try {
      if(!file)throw new Error('Choose a PDF to upload.');
      const signaturePages=ganSignaturePages(pages);if(kind==='special_conditions'&&!signaturePages.length)throw new Error('Enter the Special Conditions signature page numbers.');
      if(!request.current)request.current={requestId:crypto.randomUUID(),kind,title,signaturePages};
      const saved=await base44.ganPackages.upload(nofoId,request.current,file);await onUploaded(saved.attachment);request.current=null;setTitle('');setPages('');setFile(null);setReset(value=>value+1);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return {kind,title,pages,file,busy,error,reset,change,upload};
}
