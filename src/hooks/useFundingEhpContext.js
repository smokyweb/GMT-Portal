import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useFundingEhpContext(applicationId) {
  const [context,setContext]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;setContext(null);setError('');
    if(applicationId)base44.ehp.application(applicationId).then(value=>{if(active)setContext(value);}).catch(err=>{if(active)setError(err.message);});
    return()=>{active=false;};
  },[applicationId]);return {context,error};
}
