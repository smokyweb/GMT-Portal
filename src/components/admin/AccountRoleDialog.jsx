import {useState} from 'react';
import {Button} from '@/components/admin/ui';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter} from '@/components/admin/ui';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/admin/ui';
import {roleLabel} from '@/lib/adminAccountData';
export default function AccountRoleDialog({user,busy,onClose,onSubmit}) {
  const [role,setRole]=useState(user.role);
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent aria-describedby="role-account-description" className="max-w-sm">
    <DialogHeader><DialogTitle>Change role</DialogTitle></DialogHeader>
    <p id="role-account-description" className="text-sm text-muted-foreground">{user.full_name||user.email}</p>
    <Select value={role} onValueChange={setRole}><SelectTrigger aria-label="New user role"><SelectValue/></SelectTrigger>
      <SelectContent>{['user','reviewer','admin','isc_admin'].map(value=><SelectItem key={value} value={value}>{roleLabel(value)}</SelectItem>)}</SelectContent></Select>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button disabled={busy} onClick={()=>onSubmit(role)}>{busy?'Saving…':'Save'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
