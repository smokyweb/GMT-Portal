import {Upload,Users} from 'lucide-react';
import {Button,Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter,DialogDescription} from '@/components/admin/ui';
import {useBulkAccountUpload} from '@/hooks/useBulkAccountUpload';
import BulkAccountTemplate from '@/components/admin/BulkAccountTemplate';
import BulkAccountPreview from '@/components/admin/BulkAccountPreview';
import BulkAccountResult from '@/components/admin/BulkAccountResult';
export default function BulkUserUpload({onSuccess,user}) {
  const state=useBulkAccountUpload(onSuccess);
  return <><Button variant="outline" size="sm" className="gap-2" onClick={()=>state.setOpen(true)}><Users className="h-3.5 w-3.5"/>Bulk Upload</Button>
    <Dialog open={state.open} onOpenChange={open=>!open&&state.close()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Bulk Upload Users</DialogTitle></DialogHeader>
      <DialogDescription className="text-sm text-muted-foreground">Administrators only. Review the dry run before creating accounts and sending invitations.</DialogDescription>
      {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div className="space-y-5 py-1">{!state.result&&<><BulkAccountTemplate/>
        <section className="space-y-2"><p className="text-sm font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-primary"/>Step 2 — Upload Your CSV</p>
          <input aria-label="Upload user CSV" type="file" accept=".csv" disabled={state.busy} onChange={e=>state.upload(e.target.files?.[0])} className="w-full border-2 border-dashed rounded-lg p-6"/>
        </section></>}
        {state.preview&&<BulkAccountPreview preview={state.preview}/>}
        {state.result&&<BulkAccountResult result={state.result}/>}
      </div><DialogFooter><Button variant="outline" disabled={state.busy} onClick={state.close}>Close</Button>
        {state.preview&&<Button disabled={state.busy||!state.preview.valid} onClick={state.commit}>{state.busy?'Processing…':`Import ${state.preview.valid} users and send invites`}</Button>}
      </DialogFooter>
    </DialogContent></Dialog>
  </>;
}
