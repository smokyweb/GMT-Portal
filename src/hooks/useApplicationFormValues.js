import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {formExportCsv} from '@/lib/forms/applicationDraft';
import {downloadAccountCsv} from '@/lib/accountCsv';
export function useApplicationFormValues(applicationId,audience) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;setData(null);setError('');
    base44.forms.application(applicationId,audience).then(result=>{if(active)setData(result);}).catch(err=>{if(active)setError(err.message);});
    return()=>{active=false;};
  },[applicationId,audience]);
  const download=async()=>{setBusy(true);setError('');try{const result=await base44.forms.application(applicationId,'export');downloadAccountCsv(formExportCsv(result.fields),'application-form.csv');}catch(err){setError(err.message);}finally{setBusy(false);}};
  return {data,error,busy,download};
}
