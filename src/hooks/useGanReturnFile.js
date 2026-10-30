import {useRef,useState} from 'react';
export function useGanReturnFile(part,onUpload) {
  const input=useRef(null),[file,setFile]=useState(null),[pages,setPages]=useState((part.signaturePages.length?part.signaturePages:Array.from({length:part.pages},(_,index)=>index+1)).join(', '));
  const save=async()=>{if(await onUpload(part.kind,file,pages)){setFile(null);if(input.current)input.current.value='';}};
  return {input,file,setFile,pages,setPages,save};
}
