import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useGanWorkflowCatalog() {
  const [documents,setDocuments]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const refresh=async()=>{setLoading(true);setError('');try{const data=await base44.ganWorkflow.list();setDocuments(data.documents);}catch(problem){setError(problem.message);}finally{setLoading(false);}};
  useEffect(()=>{let active=true;base44.ganWorkflow.list().then(data=>{if(active)setDocuments(data.documents);}).catch(problem=>{if(active)setError(problem.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  return {documents,loading,error,refresh};
}
