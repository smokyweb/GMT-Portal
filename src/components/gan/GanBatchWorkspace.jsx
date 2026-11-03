import GanPackageEditor from './GanPackageEditor';
import GanBatchSharedIssues from './GanBatchSharedIssues';
import {useGanBatchWorkspace} from '@/hooks/useGanBatchWorkspace';
import GanBatchSelect from './GanBatchSelect';
import GanBatchSelection from './GanBatchSelection';
import GanBatchOfficials from './GanBatchOfficials';
import GanBatchRows from './GanBatchRows';
import GanBatchProgress from './GanBatchProgress';
import GanBatchActions from './GanBatchActions';
export default function GanBatchWorkspace({onClose,standalone=false,initialTemplateId=''}) {
  const state=useGanBatchWorkspace(initialTemplateId),Heading=standalone?'h1':'h2';
  return <section aria-label="Generate Award Documents" className="space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <Heading className={standalone?'text-2xl font-bold':'text-lg font-bold'}>Generate Award Documents</Heading><p className="mt-1 text-sm text-muted-foreground">Check the selected awards, then save ready GAN drafts. Blocked rows retain their correction details.</p>
    </div><button type="button" onClick={onClose} disabled={Boolean(state.busy)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">{standalone?'Back to templates':'Close'}</button></div>
    {state.catalog.batches.length>0&&<GanBatchSelect label="Resume saved batch" value={state.batch?.id||''} onChange={state.load} disabled={Boolean(state.busy)}
      options={state.catalog.batches}/>}
    <GanBatchSelection state={state}/><GanBatchSharedIssues issues={state.sharedIssues}/><GanBatchOfficials state={state}/><GanBatchProgress batch={state.batch}/>
    {state.error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.busy&&<p role="status" className="text-sm text-muted-foreground">{state.busy}</p>}
    {state.notice&&<p role="status" className="text-sm text-green-800">{state.notice}</p>}
    <GanBatchRows state={state}/><GanBatchActions state={state}/>
    {state.packageTarget&&<GanPackageEditor key={state.packageTarget.id+state.packageTarget.revision} nofoId={state.selection.nofoId} document={state.packageTarget} onClose={state.closePackage}/>}
  </section>;
}
