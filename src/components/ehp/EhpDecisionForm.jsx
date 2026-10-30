export default function EhpDecisionForm({state,onDecision}) {
  return <fieldset disabled={state.busy} className="space-y-3 border rounded p-3">
    <legend className="text-xs font-semibold px-1">Record external EHP approval</legend>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs">Approval reference<input aria-label="EHP approval reference" value={state.reference} onChange={e=>state.setReference(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" placeholder="Approval letter or case reference" /></label>
      <label className="text-xs">Approval date<input aria-label="EHP approval date" type="date" value={state.date} onChange={e=>state.setDate(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
    </div>
    <label className="block text-xs">Review notes<textarea aria-label="EHP review notes" value={state.notes} onChange={e=>state.setNotes(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" rows={2} /></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!state.context.required||!state.reference.trim()||!state.date} onClick={()=>onDecision('Approved')} className="rounded border px-3 py-2 text-xs bg-primary text-primary-foreground disabled:opacity-50">Record EHP Approval</button>
      <button type="button" disabled={!state.notes.trim()} onClick={()=>onDecision('ScreeningRequired')} className="rounded border px-3 py-2 text-xs disabled:opacity-50">{state.context.required?'Reopen EHP Review':'Require EHP Review'}</button>
    </div>
  </fieldset>;
}
