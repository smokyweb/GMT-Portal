import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {accountStats,availableOrganizations,filterAccounts} from '@/lib/adminAccountData';
export function useAdminAccounts() {
  const [user,setUser]=useState(null),[users,setUsers]=useState([]),[organizations,setOrganizations]=useState([]),[grantees,setGrantees]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState('all'),[statusFilter,setStatusFilter]=useState('all');
  const [sortColumn,setSortColumn]=useState('name'),[sortDirection,setSortDirection]=useState('asc');
  const [selected,setSelected]=useState(new Set()),[bulkAction,setBulkAction]=useState(''),[bulkValue,setBulkValue]=useState('');
  const [dialog,setDialog]=useState(null),[temporaryPassword,setTemporaryPassword]=useState(''),[needsSignIn,setNeedsSignIn]=useState(false);
  const refresh=async()=>setUsers(await base44.accounts.list());
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const [context,people,orgs,states]=await Promise.all([base44.accounts.context(),base44.accounts.list(),
          base44.entities.Organization.filter({is_active:true}),base44.entities.Grantee.list('-created_date',200)]);
        if(!active)return;
        setUser(context);setUsers(people);setOrganizations(availableOrganizations(orgs,context));setGrantees(states);
      }catch(err){if(active)setError(err.message);}
      finally{if(active)setLoading(false);}
    })();return()=>{active=false;};
  },[]);
  const run=async(action,message,close=true)=>{
    setBusy(true);setError('');setNotice('');setTemporaryPassword('');
    try {
      const result=await action();setNotice(message);
      if(result?.temporary_password)setTemporaryPassword(result.temporary_password);else if(close)setDialog(null);
      try {await refresh();} catch(err) {
        if([401,403].includes(err.status)) {
          if(result?.temporary_password)setNeedsSignIn(true);else await base44.auth.logout('/login');
        } else setError('The change was saved, but the account list could not refresh. Reload the page.');
      }
      return true;
    }catch(err){setError(err.message||'Unable to complete this action');return false;}
    finally{setBusy(false);}
  };
  const invite=data=>run(()=>base44.accounts.invite(data),'Invitation accepted by the email provider.');
  const reset=data=>run(()=>base44.accounts.reset(dialog.user.id,data),
    data.method==='temporary'?'Temporary password created. It must be changed at next login.':'Reset email accepted by the email provider.');
  const resend=target=>run(()=>base44.accounts.resendInvite(target.id),'Invitation email accepted by the email provider.');
  const edit=data=>run(()=>base44.accounts.update(dialog.user.id,data),'User updated.');
  const remove=()=>run(()=>base44.entities.User.delete(dialog.user.id),'User removed.');
  const setStatus=target=>run(()=>base44.accounts.update(target.id,{active_status:target.active_status==='active'?'inactive':'active'}),'Account status updated.');
  const closeDialog=()=>{if(!busy){setDialog(null);setTemporaryPassword('');setError('');if(needsSignIn)base44.auth.logout('/login');}};
  const sort=column=>{setSortDirection(sortColumn===column&&sortDirection==='asc'?'desc':'asc');setSortColumn(column);};
  const toggle=id=>setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});
  const visible=filterAccounts(users,{search,role:roleFilter,status:statusFilter,column:sortColumn,direction:sortDirection});
  const selectAll=checked=>setSelected(checked?new Set(visible.map(item=>item.id)):new Set());
  const clearSelection=()=>{setSelected(new Set());setBulkAction('');setBulkValue('');};
  const applyBulk=async()=>{
    if(!selected.size||!bulkAction||!bulkValue)return;
    if(await run(()=>base44.accounts.bulkUpdate([...selected],{[bulkAction==='status'?'active_status':'role']:bulkValue}),'Selected accounts updated.',false))clearSelection();
  };
  return {user,users:visible,organizations,grantees,loading,error,notice,busy,search,setSearch,roleFilter,setRoleFilter,statusFilter,setStatusFilter,
    sortColumn,sortDirection,sort,selected,toggle,selectAll,bulkAction,setBulkAction,bulkValue,setBulkValue,clearSelection,applyBulk,
    stats:accountStats(users),dialog,setDialog,closeDialog,temporaryPassword,invite,reset,resend,edit,remove,setStatus,refresh};
}
