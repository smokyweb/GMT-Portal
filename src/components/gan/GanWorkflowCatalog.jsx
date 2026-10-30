import {Link} from 'react-router-dom';
import {useGanWorkflowCatalog} from '@/hooks/useGanWorkflowCatalog';
import {ganPhaseLabel,ganWorkflowDate} from '@/lib/documents/ganWorkflowPresentation';
import GanBatchButton from './GanBatchButton';
export default function GanWorkflowCatalog() {
  const state=useGanWorkflowCatalog();
  return <section aria-label="Issued award documents" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Issued award documents</h2><GanBatchButton outline onClick={state.refresh} disabled={state.loading}>Refresh awards</GanBatchButton></div>
    {state.loading&&<p role="status" className="text-sm">Loading assigned awards…</p>}{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {!state.loading&&!state.error&&!state.documents.length&&<p className="rounded-lg border p-5 text-sm text-muted-foreground">No issued GANs are assigned to this account.</p>}
    <div className="space-y-3">{state.documents.map(item=><article key={item.id} className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><Link to={'/award-documents/'+item.id} className="font-semibold text-primary underline">{item.applicationNumber} · {item.organizationName}</Link><span className="rounded bg-muted px-2 py-1 text-xs">{ganPhaseLabel(item.phase)}</span></div>
      <p className="break-words text-sm">Subaward {item.subawardNumber} · Projects: {item.projectIds.join(', ')}</p>
      <p className="text-xs text-muted-foreground">Issued {ganWorkflowDate(item.issuedAt)} · Assigned official: {item.recipientName}</p>
      <Link to={'/award-documents/'+item.id} className="inline-block text-sm font-medium text-primary underline">{item.canAct?'Review & sign':'View award and activity'}</Link>
    </article>)}</div>
  </section>;
}
