import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useAwardDetails(id) {
  const [context,setContext]=useState(null),[fields,setFields]=useState({}),[resets,setResets]=useState([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{let active=true;setContext(null);setError('');setNotice('');setResets([]);
    base44.awards.application(id).then(value=>{if(active){setContext(value);setFields(value.award.fields);}}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};
  },[id]);
  const setField=(key,value)=>{setFields(current=>({...current,[key]:value}));setResets(current=>current.filter(item=>item!==key));setNotice('');};
  const restore=key=>{setFields(current=>({...current,[key]:context.inherited[key]}));setResets(current=>[...new Set([...current,key])]);setNotice('');};
  const save=async()=>{setBusy(true);setError('');setNotice('');try{
    const changes=Object.fromEntries(Object.entries(fields).filter(([key,value])=>!resets.includes(key)&&String(value??'')!==String(context.award.fields[key]??'')));
    const value=await base44.awards.save(id,context.award.revision,changes,resets);setContext(value);setFields(value.award.fields);setResets([]);setNotice('Award Details saved.');return value.application;
  }catch(err){setError(err.message);return null;}finally{setBusy(false);}};
  return {context,fields,busy,error,notice,setField,restore,save};
}
