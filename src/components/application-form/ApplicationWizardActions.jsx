export default function ApplicationWizardActions({state}) {
  const index=state.sections.indexOf(state.section);
  return <div className="flex justify-between flex-wrap gap-3">
    <div className="flex gap-2"><button type="button" disabled={state.busy||index===0} onClick={()=>state.setStepId(state.sections[index-1].id)} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
      <button type="button" disabled={state.busy} onClick={()=>state.navigate('/my-applications')} className="rounded border px-3 py-2 text-sm">Close</button></div>
    <div className="flex gap-2"><button type="button" disabled={state.busy||state.submitted} onClick={state.save} className="rounded border px-3 py-2 text-sm disabled:opacity-40">{state.busy?'Saving…':'Save Draft'}</button>
      {state.section.kind==='review'?<button type="button" disabled={state.busy||!state.confirmed||state.submitted} onClick={state.submit} className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-40">Submit Application</button>:
        <button type="button" disabled={state.busy||state.submitted} onClick={state.next} className="rounded bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-40">Next</button>}</div>
  </div>;
}
