import GanSendIssues from './GanSendIssues';
import {Link} from 'react-router-dom';
import {useGanSendPanel} from '@/hooks/useGanSendPanel';
import GanSendTokenCheck from './GanSendTokenCheck';
import GanBatchButton from './GanBatchButton';
import GanConsentCheckbox from './GanConsentCheckbox';
export default function GanSendPanel({documentId,packageId,previewUrl,pdfRendered}) {
  const state=useGanSendPanel(documentId,packageId),issued=state.record?.issue;
  return <section aria-label="Preview and send" className="space-y-4 rounded-lg border bg-card p-4">
    <h3 className="text-lg font-semibold">Preview &amp; Send</h3>
    {state.busy&&<p role="status" className="text-sm">{state.busy}</p>}
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}<GanSendIssues issues={state.issues}/>
    {state.check&&!issued&&<GanSendTokenCheck check={state.check}/>}
    {!issued&&<>
      <p className="text-xs text-muted-foreground">Review every page in the saved package PDF before issuing it. Missing or changed source fields block sending.</p>
      <GanConsentCheckbox label="I reviewed this saved GAN and its attached Special Conditions." checked={state.reviewed} onChange={state.setReviewed} disabled={!previewUrl||!pdfRendered||Boolean(state.busy)}/>
      <GanBatchButton onClick={state.send} disabled={!state.check?.ready||!state.reviewed||!previewUrl||!pdfRendered||Boolean(state.busy)}>Send for signature</GanBatchButton>
    </>}
    {issued&&<div role="status" className="space-y-2 text-sm"><p>Issued to {issued.recipient_name}. Email delivery has not been verified.</p><Link reloadDocument to={'/award-documents/'+documentId} className="font-medium text-primary underline">Open issued award and activity</Link></div>}
  </section>;
}
