import {useAwardDetails} from '@/hooks/useAwardDetails';
import {AWARD_FIELDS} from '@/lib/awards/awardFields';
import AwardFieldRow from './AwardFieldRow';
export default function AwardDetailsPanel({applicationId,onUpdate=(_application)=>{}}) {
  const state=useAwardDetails(applicationId);
  const save=async()=>{const application=await state.save();if(application)onUpdate(application);};
  return <section aria-label="Award Details" className="space-y-4">
    <p className="text-xs text-muted-foreground">Federal identifiers and dates are copied from the NOFO when the award record is created. An award can keep its own override.</p>
    {state.error&&<p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {!state.context&&!state.error&&<p className="text-sm text-muted-foreground">Loading Award Details…</p>}
    {state.context&&<>
      {['Identifiers','Award','Dates'].map(group=><fieldset key={group} className="border rounded p-3"><legend className="px-1 text-sm font-semibold">{group}</legend>
        <div className="grid sm:grid-cols-2 gap-4">{AWARD_FIELDS.filter(field=>field.group===group).map(field=><AwardFieldRow key={field.key} field={field} state={state}/>)}</div>
      </fieldset>)}
      {state.notice&&<p role="status" className="text-sm text-green-700">{state.notice}</p>}
      {state.context.can_edit?<button type="button" disabled={state.busy} onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{state.busy?'Saving…':'Save Award Details'}</button>:<p className="text-xs text-muted-foreground">Award Details are read only for your account.</p>}
    </>}
  </section>;
}
