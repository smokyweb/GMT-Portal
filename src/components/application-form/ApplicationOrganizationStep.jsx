export default function ApplicationOrganizationStep({state}) {
  return <div className="space-y-4">
    <label className="text-sm font-medium block">Organization<select aria-label="Application organization" value={state.organization?.id||''} disabled={state.busy||state.user?.role==='user'||Boolean(state.application)} onChange={event=>state.setOrganization(state.organizations.find(org=>org.id===event.target.value)||null)} className="block w-full border rounded p-2 mt-1 bg-background text-sm">
      <option value="">Select an organization</option>{state.organizations.map(org=><option key={org.id} value={org.id}>{org.name} ({org.state})</option>)}</select></label>
    <label className="text-sm font-medium block">NOFO / Grant Program<select aria-label="Application NOFO" value={state.nofo?.id||''} disabled={state.busy||Boolean(state.application?.nofo_id)} onChange={event=>state.chooseNofo(event.target.value)} className="block w-full border rounded p-2 mt-1 bg-background text-sm">
      <option value="">{state.user?.role==='user'?'Select a NOFO':'No NOFO selected'}</option>{state.nofos.map(nofo=><option key={nofo.id} value={nofo.id}>{nofo.title}</option>)}</select></label>
    {state.application?.form_version_id&&<p className="text-xs text-muted-foreground">This application retains the NOFO and form version selected when it was started.</p>}
    {!state.organization&&state.user?.role==='user'&&<p role="alert" className="text-sm text-amber-800">Contact your administrator to assign an organization before starting an application.</p>}
  </div>;
}
