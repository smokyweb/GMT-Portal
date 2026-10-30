import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGranteeAwardDirectory() {
  const [grantees,setGrantees]=useState([]),[id,setId]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;base44.ganSettings.directory().then(data=>{if(active){setGrantees(data.grantees);if(data.grantees.length===1)setId(data.grantees[0].id);}}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  return {grantees,id,setId,error,loading};
}
