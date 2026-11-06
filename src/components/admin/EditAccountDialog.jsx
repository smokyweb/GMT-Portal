import {useState} from 'react';
import {Button,Input,Label,Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui';
import {roleLabel} from '@/lib/adminAccountData';
export default function EditAccountDialog({state}) {
  const target=state.dialog.user;
  const [form,setForm]=useState({role:target.role,organization_id:target.organization_id||'__none__',scope_state:target.scope_state||'',phone:target.phone||'',title:target.title||'',active_status:target.active_status||'active'});
  const field=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <Dialog open onOpenChange={open=>!open&&state.closeDialog()}><DialogContent className="max-w-md">
    <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
    <div className="space-y-4 py-2"><DialogDescription>{target.full_name||'—'} · {target.email}</DialogDescription>
      {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div><Label>Role</Label><Select value={form.role} disabled={!['admin','isc_admin'].includes(state.user?.role)} onValueChange={value=>field('role',value)}>
        <SelectTrigger className="mt-1" aria-label="Edit account role"><SelectValue/></SelectTrigger>
        <SelectContent>{['user','reviewer','admin',...(state.user?.role==='isc_admin'?['isc_admin']:[])].map(role=><SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent></Select></div>
      {['admin','reviewer'].includes(form.role)&&<div><Label>State Scope</Label>
        <Select value={form.scope_state} onValueChange={value=>field('scope_state',value)}><SelectTrigger className="mt-1" aria-label="Edit account state"><SelectValue placeholder="Select state…"/></SelectTrigger>
          <SelectContent>{state.grantees.filter(grantee=>grantee.is_active&&(state.user?.role==='isc_admin'||grantee.state_code===(state.user?.scope_state||state.user?.grantee_state))).map(grantee=><SelectItem key={grantee.id} value={grantee.state_code}>{grantee.state_code} — {grantee.name}</SelectItem>)}</SelectContent></Select></div>}
      {form.role==='user'&&<div><Label>Organization</Label><Select value={form.organization_id} onValueChange={value=>field('organization_id',value)}>
        <SelectTrigger className="mt-1" aria-label="Edit account organization"><SelectValue placeholder="None"/></SelectTrigger>
        <SelectContent><SelectItem value="__none__">None</SelectItem>{state.organizations.map(org=><SelectItem key={org.id} value={org.id}>{org.name} {org.state?(`(${org.state})`):''}</SelectItem>)}</SelectContent></Select></div>}
      <div><Label htmlFor="edit-account-title">Job Title</Label><Input id="edit-account-title" className="mt-1" value={form.title} onChange={e=>field('title',e.target.value)}/></div>
      <div><Label htmlFor="edit-account-phone">Phone Number</Label><Input id="edit-account-phone" className="mt-1" value={form.phone} onChange={e=>field('phone',e.target.value)}/></div>
      <div><Label>Account Status</Label><Select value={form.active_status} onValueChange={value=>field('active_status',value)}>
        <SelectTrigger className="mt-1" aria-label="Edit account status"><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem>
          {target.active_status==='invited'&&<SelectItem value="invited">Invited</SelectItem>}</SelectContent></Select></div>
    </div><DialogFooter><Button variant="outline" disabled={state.busy} onClick={state.closeDialog}>Cancel</Button>
      <Button disabled={state.busy} onClick={()=>state.edit(form)}>{state.busy?'Saving…':'Save Changes'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
