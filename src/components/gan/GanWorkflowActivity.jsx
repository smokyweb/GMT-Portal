import {ganEventLabel,ganWorkflowDate} from '@/lib/documents/ganWorkflowPresentation';
export default function GanWorkflowActivity({events=[]}) {
  return <section aria-label="Award activity" className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Activity</h2>
    <ol className="mt-4 space-y-4">{events.map(event=><li key={event.id} className="border-l-2 pl-3 text-sm">
      <p className="font-medium">{ganEventLabel(event.action)}</p><p className="mt-1 break-words text-xs text-muted-foreground">{ganWorkflowDate(event.occurred_at)} · {event.actor_email}</p>
      {event.evidence?.note&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.evidence.note}</p>}
    </li>)}</ol>{!events.length&&<p className="mt-3 text-sm text-muted-foreground">No recorded actions.</p>}
    <p className="mt-4 text-xs text-muted-foreground">Email delivery is not verified. Issuance and recipient actions are recorded separately.</p>
  </section>;
}
