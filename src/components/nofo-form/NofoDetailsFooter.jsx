import {Button} from '@/components/ui/button';
import {DialogFooter} from '@/components/ui/dialog';

export default function NofoDetailsFooter({editing,saving,error,onCancel,onSave}) {
  return <DialogFooter className="flex-shrink-0 flex-col items-end gap-2 border-t pt-3">
    {error&&<p role="alert" className="text-sm text-red-500 w-full">{error}</p>}
    <div className="flex gap-2">
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onSave} disabled={saving}>{saving?'Saving…':editing?'Update NOFO':'Create NOFO'}</Button>
    </div>
  </DialogFooter>;
}
