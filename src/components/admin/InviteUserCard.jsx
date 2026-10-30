import BulkUserUpload from '@/components/BulkUserUpload';
import {useState} from 'react';
import {UserPlus} from 'lucide-react';
import {Button} from '@/components/admin/ui';
import {Input} from '@/components/admin/ui';
import {Label} from '@/components/admin/ui';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/admin/ui';
export default function InviteUserCard({user,organizations,grantees=[],busy,onInvite,onImported}) {
  const [form,setForm]=useState({email:'',full_name:'',role:'user',organization_id:'',scope_state:''});
  const field=(key,value)=>setForm(current=>({...current,[key]:value}));
  const submit=async event=>{
    event.preventDefault();
    if(await onInvite(form))setForm({email:'',full_name:'',role:'user',organization_id:'',scope_state:''});
  };
  return <section className="bg-card border rounded-xl p-4">
    <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4"/>Invite New User</h2>{user?.role==='isc_admin'&&<BulkUserUpload onSuccess={onImported}/>}</div>
    <form onSubmit={submit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-48"><Label htmlFor="invite-email">Email address</Label>
        <Input id="invite-email" className="mt-1" type="email" value={form.email} required onChange={e=>field('email',e.target.value)}/></div>
      <div className="flex-1 min-w-40"><Label htmlFor="invite-name">Full name</Label>
        <Input id="invite-name" className="mt-1" value={form.full_name} onChange={e=>field('full_name',e.target.value)}/></div>
      {user?.role==='isc_admin'&&<div className="w-44"><Label>Role</Label>
        <Select value={form.role} onValueChange={v=>field('role',v)}><SelectTrigger aria-label="Invitation role" className="mt-1"><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="user">Subrecipient</SelectItem><SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="admin">State Administrator</SelectItem><SelectItem value="isc_admin">ISC Administrator</SelectItem></SelectContent>
        </Select></div>}
      {form.role==='user'?<div className="flex-1 min-w-52"><Label>Organization</Label>
        <Select value={form.organization_id} onValueChange={v=>field('organization_id',v)}>
          <SelectTrigger aria-label="Invitation organization" className="mt-1"><SelectValue placeholder="Select organization"/></SelectTrigger>
          <SelectContent>{organizations.map(org=><SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent>
        </Select></div>:form.role!=='isc_admin'&&<div className="w-24"><Label htmlFor="invite-state">State</Label>
        <Select value={form.scope_state} onValueChange={value=>field('scope_state',value)}><SelectTrigger id="invite-state" aria-label="Invitation state" className="mt-1"><SelectValue placeholder="State"/></SelectTrigger>
          <SelectContent>{grantees.filter(grantee=>grantee.is_active).map(grantee=><SelectItem key={grantee.id} value={grantee.state_code}>{grantee.state_code} — {grantee.name}</SelectItem>)}</SelectContent></Select></div>}
      <Button type="submit" disabled={busy||!form.email||(form.role==='user'&&!form.organization_id)}>
        {busy?'Sending…':'Send invite'}</Button>
    </form>
    <p className="text-xs text-muted-foreground mt-3">The user receives a one-time link to set their password. Your administrator session stays signed in.</p>
  </section>;
}
