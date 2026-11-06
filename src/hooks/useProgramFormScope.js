import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
export function useProgramFormScope() {
  const [actor,setActor]=useState(null),[states,setStates]=useState([]),[scope,setScope]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;(async()=>{try{
    const [user,list]=await Promise.all([base44.accounts.context(),base44.entities.Grantee.list('-created_date')]);
    if(!active)return;setActor(user);setStates([...new Set(list.filter(item=>item.is_active!==false&&item.state_code).map(item=>item.state_code))].sort());setScope(user.role==='isc_admin'?'':user.scope_state||user.grantee_state||'');
  }catch(err){if(active)setError(err.message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);
  return {actor,states,scope,setScope,loading,error};
}
