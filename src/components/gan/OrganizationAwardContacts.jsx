import {useGanContactSettings} from '@/hooks/useGanContactSettings';
import GanBatchSelect from './GanBatchSelect';
import GanBatchButton from './GanBatchButton';
import AwardContactMessages from './AwardContactMessages';
import AwardOfficialSummary from './AwardOfficialSummary';
export default function OrganizationAwardContacts({organizationId}) {
  const state=useGanContactSettings('organization',organizationId),context=state.context;
  return <section aria-label="Organization award contacts" className="space-y-4 rounded-xl border bg-card p-5">
    <div><h2 className="font-semibold">Award contacts</h2><p className="mt-1 text-sm text-muted-foreground">Default registered official and pass-through grantee for new award documents. Saved documents retain their recorded contacts.</p></div>
    <AwardContactMessages state={state}/>
    {state.loading&&<p className="text-sm text-muted-foreground">Loading award contacts…</p>}
    {context&&<>
      <div className="grid gap-4 sm:grid-cols-2">
        <GanBatchSelect label="Authorized official" value={state.form.authorized_official_id} onChange={id=>state.field('authorized_official_id',id)}
          disabled={state.busy||!context.can_edit} options={context.choices.officials} placeholder="Not assigned"/>
        <GanBatchSelect label="Default grantee" value={state.form.grantee_id} onChange={id=>state.field('grantee_id',id)}
          disabled={state.busy||!context.can_edit} options={context.choices.grantees} placeholder="Not assigned"/>
      </div>
      <AwardOfficialSummary official={context.official} canManage={context.can_edit} isViewer={context.viewer_is_official}/>
      {context.can_edit?<div className="flex flex-wrap gap-2"><GanBatchButton disabled={state.busy} onClick={state.save}>{state.busy?'Saving…':'Save award contacts'}</GanBatchButton>
        <GanBatchButton outline disabled={state.busy} onClick={state.reload}>Reload settings</GanBatchButton></div>:<p className="text-xs text-muted-foreground">Your assigned administrator manages these designations.</p>}
    </>}
  </section>;
}
