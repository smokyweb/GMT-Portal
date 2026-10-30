import {useGranteeAwardDirectory} from '@/hooks/useGranteeAwardDirectory';
import GanBatchSelect from './GanBatchSelect';
import GranteeAwardEditor from './GranteeAwardEditor';
export default function GranteeAwardSettings() {
  const state=useGranteeAwardDirectory();
  return <section aria-label="Grantee award settings" className="space-y-4 rounded-xl border bg-card p-5">
    <div><h2 className="font-semibold">Grantee award settings</h2><p className="mt-1 text-sm text-muted-foreground">Configure pass-through contact details and the NEMA approving official used by new GAN drafts.</p></div>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.loading?<p className="text-sm text-muted-foreground">Loading grantees…</p>:<GanBatchSelect label="Grantee award settings agency" value={state.id} onChange={state.setId} options={state.grantees}/>}
    {state.id&&<GranteeAwardEditor key={state.id} granteeId={state.id}/>}
  </section>;
}
