import GanBatchButton from './GanBatchButton';
export default function GanRejectForm({state,disabled}) {
  return <div className="space-y-3 border-t pt-3"><label className="block text-sm font-medium">Reason for rejection
    <textarea aria-label="Reason for rejection" value={state.note} onChange={event=>state.setNote(event.target.value)} maxLength={4000} rows={4} disabled={disabled} className="mt-2 w-full rounded border bg-background p-2 text-sm"/>
  </label><p className="text-xs text-muted-foreground">Explain what the issuing team needs to change. This note is retained in the award activity.</p>
    <div className="flex flex-wrap gap-2"><GanBatchButton onClick={state.reject} disabled={disabled||!state.note.trim()}>Confirm rejection</GanBatchButton><GanBatchButton outline onClick={()=>state.setRejecting(false)} disabled={disabled}>Cancel rejection</GanBatchButton></div>
  </div>;
}
