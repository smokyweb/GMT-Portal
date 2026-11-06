import {useApplicationFormValues} from '@/hooks/useApplicationFormValues';
import {readableValue} from '@/lib/forms/applicationDraft';
export default function ApplicationFormValues({applicationId,audience='reviewer',compact=false}) {
  const state=useApplicationFormValues(applicationId,audience);
  if(state.error)return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if(!state.data?.version)return null;
  return <section className={compact?'space-y-1':'rounded-lg border p-4 space-y-3'}>
    <div className="flex justify-between items-center gap-2"><h3 className={compact?'text-xs text-muted-foreground':'text-sm font-semibold'}>NOFO Application Form · Version {state.data.version.version}</h3><button type="button" disabled={state.busy} onClick={state.download} className="border rounded px-2 py-1 text-xs">Export Form Values</button></div>
    {!compact&&<div className="divide-y">{state.data.fields.map(field=><div key={field.id} className="py-2"><p className="text-xs text-muted-foreground">{field.label}</p><p className="text-sm whitespace-pre-wrap mt-1">{readableValue(field.value,field)}</p></div>)}</div>}
  </section>;
}
