import {useState} from 'react';
import {Button} from '@/components/admin/ui';
import {Input} from '@/components/admin/ui';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription} from '@/components/admin/ui';
export default function PasswordResetDialog({user,busy,error,onClose,onSubmit,temporaryPassword}) {
  const [method,setMethod]=useState('email');
  const [revokeSessions,setRevokeSessions]=useState(true);
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>Reset password — {user.full_name||user.email}</DialogTitle></DialogHeader>
    <DialogDescription className="text-sm text-muted-foreground">{user.email} · {user.organization_name||'GMT Portal'}</DialogDescription>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {temporaryPassword?<div className="space-y-3">
      <p className="text-sm">Give this temporary password to the user securely. It is shown once and must be changed at next login.</p>
      <Input aria-label="Temporary password" readOnly value={temporaryPassword}/>
    </div>:<div className="space-y-4 text-sm">
      <label className="flex items-start gap-2"><input type="radio" name="reset-method" value="email" checked={method==='email'} onChange={()=>setMethod('email')}/>
        Send a password-reset link by email (expires in 24 hours)</label>
      <label className="flex items-start gap-2"><input type="radio" name="reset-method" value="temporary" checked={method==='temporary'} onChange={()=>setMethod('temporary')}/>
        Set a temporary password (user must change it at next login)</label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={revokeSessions} onChange={e=>setRevokeSessions(e.target.checked)}/>
        Sign the user out of all active sessions</label>
      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">Every reset is recorded in the Audit Log. State administrators can reset subrecipient accounts in their own state only.</p>
    </div>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
      {!temporaryPassword&&<Button disabled={busy} onClick={()=>onSubmit({method,revoke_sessions:revokeSessions})}>
        {busy?'Processing…':method==='email'?'Send reset link':'Create temporary password'}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
