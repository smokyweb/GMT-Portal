import {Button} from '@/components/admin/ui';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription} from '@/components/admin/ui';
export default function DeleteAccountDialog({user,busy,error,onClose,onSubmit}) {
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle>Remove user</DialogTitle></DialogHeader>
    <DialogDescription className="text-sm text-muted-foreground">Remove {user.full_name||user.email}? This action cannot be undone.</DialogDescription>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="destructive" disabled={busy} onClick={onSubmit}>{busy?'Removing…':'Remove user'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
