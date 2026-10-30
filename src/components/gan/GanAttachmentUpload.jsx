import {useGanAttachmentUpload} from '@/hooks/useGanAttachmentUpload';
import GanBatchSelect from './GanBatchSelect';
import GanBatchButton from './GanBatchButton';
import AwardContactInput from './AwardContactInput';
export default function GanAttachmentUpload({nofoId,onUploaded,disabled=false}) {
  const state=useGanAttachmentUpload(nofoId,onUploaded),locked=disabled||state.busy;
  return <details className="rounded-lg border bg-background p-3">
    <summary className="cursor-pointer text-sm font-medium">Upload a new NOFO attachment version</summary>
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">Upload the approved Special Conditions or a blank Direct Deposit form. Saved versions remain attached to existing packages.</p>
      <GanBatchSelect label="Attachment type" value={state.kind} onChange={value=>state.change('kind',value)} disabled={locked}
        options={[{id:'special_conditions',name:'Special Conditions'},{id:'direct_deposit',name:'Blank Direct Deposit form'}]}/>
      <AwardContactInput label="Attachment title" value={state.title} onChange={value=>state.change('title',value)} disabled={locked}/>
      <AwardContactInput label="Signature pages in this PDF" value={state.pages} onChange={value=>state.change('pages',value)} disabled={locked}/>
      <p className="text-xs text-muted-foreground">Use page numbers such as 2, 4. Required for Special Conditions; the Direct Deposit form is optional.</p>
      <label className="block text-xs font-medium">Attachment PDF<input key={state.reset} aria-label="Attachment PDF" type="file" accept="application/pdf,.pdf" disabled={locked}
        onChange={event=>state.change('file',event.target.files?.[0]||null)} className="mt-1 block w-full rounded border p-2 text-sm"/></label>
      {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <GanBatchButton onClick={state.upload} disabled={locked||!state.file||!state.title}>{state.busy?'Uploading…':'Save attachment version'}</GanBatchButton>
    </div>
  </details>;
}
