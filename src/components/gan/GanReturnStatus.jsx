import {ganPhaseLabel} from '@/lib/documents/ganWorkflowPresentation';
export default function GanReturnStatus({record}) {
  return <section aria-label="Signed upload status" className="space-y-3 rounded-lg border bg-card p-4"><h2 className="font-semibold">{ganPhaseLabel(record.phase)}</h2>
    <p className="text-sm">{record.phase==='Uploaded'?'NEMA grants staff will compare the submitted pages against the issued package.':'The signed uploads were accepted. Assistant Director countersignature is still required.'}</p>
    <p className="text-xs text-muted-foreground">This award is not fully executed. The final signed package and award activation are still pending.</p>
  </section>;
}
