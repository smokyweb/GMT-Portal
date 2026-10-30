import GanBatchSelect from './GanBatchSelect';
export default function GanBatchOfficials({state}) {
  if(!state.catalog.organizations.length)return null;
  return <details className="rounded-lg border bg-card p-4" open={!state.batch}>
    <summary className="cursor-pointer text-sm font-semibold">Authorized officials for this batch</summary>
    <p className="mt-2 text-xs text-muted-foreground">Saved officials are preselected. You can choose a registered official for this batch without changing organization settings.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{state.catalog.organizations.map(org=><GanBatchSelect key={org.id} label={org.name}
      value={state.selection.officialsByOrganization[org.id]} onChange={id=>state.official(org.id,id)} disabled={Boolean(state.busy||state.batch)}
      options={org.officialOptions}
      placeholder="Select registered official"/>)}</div>
  </details>;
}
