import {latestGanReturnUploads} from '@/lib/documents/ganReturnPresentation';
import GanReturnUploadSlot from './GanReturnUploadSlot';
import GanReturnSignerFields from './GanReturnSignerFields';
import GanBatchButton from './GanBatchButton';
export default function GanReturnForm({workflow,state}) {
  const locked=Boolean(state.busy||workflow.busy)||!workflow.rendered||!workflow.record.returns.canUpload;
  return <section aria-label="Print sign and upload" className="space-y-4 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">Print, sign &amp; upload</h2>
    <p className="text-sm">Download the award package, sign the GAN and required Special Conditions pages, then upload the signed pages below.</p>
    <GanBatchButton outline onClick={workflow.download} disabled={locked}>Download package to print and sign</GanBatchButton>
    {!workflow.rendered&&<p className="text-sm text-amber-800">Load the issued PDF before uploading or submitting.</p>}
    {workflow.record.phase==='UploadReturned'&&<p className="rounded border border-amber-200 p-2 text-sm text-amber-900">Returned for correction. Review NEMA’s note in Activity, replace the affected files, then confirm and resubmit.</p>}
    {latestGanReturnUploads(workflow.record.returns).map(({part,upload})=><GanReturnUploadSlot key={part.kind} part={part} upload={upload} onUpload={state.upload} onDownload={state.download} disabled={locked}/>)}
    <GanReturnSignerFields state={state} disabled={locked}/>
    {state.busy&&<p role="status" className="text-sm">{state.busy}</p>}{state.notice&&<p role="status" className="text-sm text-green-800">{state.notice}</p>}
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.missing.length>0&&<p className="text-xs text-amber-900">Still required: {state.missing.join('; ')}. Every declared signature page must be included.</p>}
    <GanBatchButton onClick={state.submit} disabled={locked||state.missing.length>0||!state.form.confirmed}>Submit signed documents</GanBatchButton>
  </section>;
}
