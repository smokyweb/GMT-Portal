import {useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {base44} from '@/api/base44Client';
export function useAccountPassword({temporary=false}={}) {
  const [params,setParams]=useSearchParams();
  const [token]=useState(()=>params.get('token')||'');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  useEffect(()=>{if(token)setParams({}, {replace:true});},[token,setParams]);
  const submit=async event=>{
    event.preventDefault();setError('');
    if(password.length<12||password.length>128){setError('Use a password between 12 and 128 characters.');return;}
    if(password!==confirmation){setError('The passwords do not match.');return;}
    setBusy(true);
    try {
      if(temporary)await base44.accounts.changePassword(password);
      else await base44.accounts.complete(token,password);
      base44.auth.logout();
      navigate('/login?passwordUpdated=1',{replace:true});
    }catch(err){setError(err.message||'Unable to set your password');}
    finally{setBusy(false);}
  };
  return {password,setPassword,confirmation,setConfirmation,busy,error,submit,missingLink:!temporary&&!token};
}
