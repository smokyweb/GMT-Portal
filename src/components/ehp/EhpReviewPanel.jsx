import {useEhpReview} from '@/hooks/useEhpReview';
import EhpBudgetRows from './EhpBudgetRows';
import EhpDecisionForm from './EhpDecisionForm';
import EhpHistory from './EhpHistory';
export default function EhpReviewPanel({applicationId,onUpdate=(_application)=>{}}) {
  const state=useEhpReview(applicationId),context=state.context;
  const apply=async action=>{const application=await action();if(application)onUpdate(application);};
  return <section aria-label="EHP review" className="rounded-lg border p-4 space-y-3">
    <h3 className="text-sm font-semibold">Environmental & Historic Preservation Review</h3>
    {state.error&&<p role="alert" className="text-xs text-destructive">{state.error}</p>}
    {!context&&!state.error&&<p className="text-xs text-muted-foreground">Loading EHP review…</p>}
    {context&&<>
      <p className="text-xs">Status: <strong>{context.application.ehp_status||'Not recorded'}</strong>{context.application.ehp_approval_date?' · Approval date: '+String(context.application.ehp_approval_date).slice(0,10):''}</p>
      <EhpBudgetRows context={context} busy={state.busy} onClassify={(id,affected)=>apply(()=>state.classify(id,affected))} />
      {context.can_edit&&<EhpDecisionForm state={state} onDecision={decision=>apply(()=>state.decide(decision))} />}
      <EhpHistory history={context.history} />
    </>}
  </section>;
}
