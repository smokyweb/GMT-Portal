import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {settingsForm,chooseGanApprover,presentGanSettings} from '@/lib/documents/ganSettingsPresentation';
export function useGanContactSettings(kind,id) {
  const [context,setContext]=useState(null),[form,setForm]=useState(/** @type {Record<string, any>} */({})),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const read=()=>kind==='organization'?base44.ganSettings.organization(id):base44.ganSettings.grantee(id);
  useEffect(()=>{let active=true;setLoading(true);setError('');setNotice('');setContext(null);
    if(!id){setLoading(false);return()=>{active=false;};}
    read().then(data=>{if(active){setContext(presentGanSettings(data));setForm(settingsForm(data));}}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[kind,id]);
  const field=(key,value)=>{setForm(current=>({...current,[key]:value}));setNotice('');};
  const approver=id=>{setForm(current=>chooseGanApprover(current,context.choices.approvers,id));setNotice('');};
  const save=async()=>{
    setBusy(true);setError('');setNotice('');
    try {
      const input={...form,expectedRevision:context.revision},saved=kind==='organization'?await base44.ganSettings.saveOrganization(id,input):await base44.ganSettings.saveGrantee(id,input);
      setContext(presentGanSettings(saved));setForm(settingsForm(saved));setNotice('Award settings saved.');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const reload=async()=>{setBusy(true);setError('');setNotice('');try{const data=await read();setContext(presentGanSettings(data));setForm(settingsForm(data));}catch(err){setError(err.message);}finally{setBusy(false);}};
  return {context,form,loading,busy,error,notice,field,approver,save,reload};
}
