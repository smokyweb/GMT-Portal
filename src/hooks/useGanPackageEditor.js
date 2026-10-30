import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {ganAttachmentOptions} from '@/lib/documents/ganPackagePresentation';
export function useGanPackageEditor(nofoId,target) {
  const [sources,setSources]=useState([]),[history,setHistory]=useState([]),[record,setRecord]=useState(null),[selected,setSelected]=useState(null);
  const [conditionsId,setConditionsId]=useState(''),[depositId,setDepositId]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[previewUrl,setPreviewUrl]=useState('');
  const request=useRef(null),blobUrl=useRef('');
  const clearPreview=()=>{if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);blobUrl.current='';setPreviewUrl('');};
  useEffect(()=>{let active=true;
    Promise.all([base44.ganPackages.attachments(nofoId),base44.ganPackages.history(target.id),base44.ganPackages.document(target.id)]).then(async([attachments,versions,document])=>{
      const current=versions.packages.find(p=>p.gan_revision===target.revision),details=current?await base44.ganPackages.package(current.id):null;
      if(!active)return;setSources(attachments.attachments);setHistory(versions.packages);setRecord(document);setSelected(details);
      setConditionsId(details?.manifest.parts.find(p=>p.kind==='special_conditions')?.source_id||ganAttachmentOptions(attachments.attachments,'special_conditions')[0]?.id||'');
      setDepositId(details?.manifest.parts.find(p=>p.kind==='direct_deposit')?.source_id||'');
    }).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);};
  },[nofoId,target.id,target.revision]);
  const choose=(kind,id)=>{if(kind==='conditions')setConditionsId(id);else setDepositId(id);request.current=null;setNotice('');};
  const uploaded=async attachment=>{
    const data=await base44.ganPackages.attachments(nofoId);setSources(data.attachments);choose(attachment.kind==='special_conditions'?'conditions':'deposit',attachment.id);
    setNotice('Attachment version saved for this NOFO. Existing packages keep their previous versions.');
  };
  const prepare=async()=>{
    setBusy('Saving package…');setError('');setNotice('');
    try {
      if(!request.current)request.current={requestId:crypto.randomUUID(),expectedGanRevision:target.revision,expectedPackageRevision:history[0]?.package_revision||0,conditionsId,depositId:depositId||null};
      const made=await base44.ganPackages.prepare(target.id,request.current),details=await base44.ganPackages.package(made.package.id),versions=await base44.ganPackages.history(target.id);
      clearPreview();setSelected(details);setHistory(versions.packages);request.current=null;setNotice('Draft package saved. Review the required signature pages.');
    }catch(err){setError(err.message);}finally{setBusy('');}
  };
  const view=async id=>{
    setBusy('Loading saved package…');setError('');try{clearPreview();const details=await base44.ganPackages.package(id);setSelected(details);}catch(err){setError(err.message);}finally{setBusy('');}
  };
  const preview=async()=>{
    setBusy('Loading PDF preview…');setError('');try{clearPreview();const blob=await base44.ganPackages.pdf(selected.package.id);blobUrl.current=URL.createObjectURL(blob);setPreviewUrl(blobUrl.current);}catch(err){setError(err.message);}finally{setBusy('');}
  };
  const download=async()=>{setBusy('Downloading package…');setError('');try{await base44.ganPackages.download(selected.package.id);}catch(err){setError(err.message);}finally{setBusy('');}};
  return {sources,history,record,selected,conditionsId,depositId,error,notice,busy,loading,previewUrl,stale:record&&record.document.revision!==target.revision,choose,uploaded,prepare,view,preview,download,
    conditions:ganAttachmentOptions(sources,'special_conditions'),deposits:ganAttachmentOptions(sources,'direct_deposit')};
}
