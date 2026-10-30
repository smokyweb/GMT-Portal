import {readableValue,formExportCsv,reviewFields} from '@/lib/forms/applicationDraft';
import {downloadAccountCsv} from '@/lib/accountCsv';
export default function ApplicationReview({state}) {
  return <div className="space-y-4">
    {state.submitted?<p role="status" className="rounded border border-green-200 bg-green-50 text-green-800 p-4">Application submitted successfully.</p>:<p className="text-sm text-muted-foreground">Review your entries before submitting. The portal checks the required fields, documents and cost share.</p>}
    <div className="divide-y border rounded">{state.fields.filter(field=>field.source!=='organization').map(field=><div key={field.id} className="p-3"><p className="text-xs text-muted-foreground">{field.label}</p><p className="text-sm whitespace-pre-wrap mt-1">{readableValue(field.value,field)}</p></div>)}</div>
    <button type="button" className="border rounded px-3 py-2 text-sm" onClick={()=>downloadAccountCsv(formExportCsv(reviewFields(state.definition,state.context,'export')),'application-form.csv')}>Export Application Form</button>
    {!state.submitted&&<label className="flex gap-3 items-start p-4 rounded border bg-amber-50 text-sm"><input type="checkbox" aria-label="Confirm application information" checked={state.confirmed} onChange={event=>state.setConfirmed(event.target.checked)} className="mt-1"/>I confirm that all information is accurate and complete. Submitted applications require administrator approval to edit.</label>}
  </div>;
}
