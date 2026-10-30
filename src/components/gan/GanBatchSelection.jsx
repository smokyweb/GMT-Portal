import GanBatchSelect from './GanBatchSelect';
export default function GanBatchSelection({state}) {
  const {catalog,selection,batch,busy}=state,disabled=Boolean(busy||batch);
  return <div className="rounded-lg border bg-card p-4 space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      <GanBatchSelect label="NOFO" value={selection.nofoId} onChange={state.chooseNofo} options={catalog.nofos} disabled={disabled}/>
      <GanBatchSelect label="Template" value={selection.templateId} onChange={value=>state.change('templateId',value)} options={catalog.templates} disabled={disabled}/>
      <GanBatchSelect label="Pass-through grantee" value={selection.granteeId} onChange={value=>state.change('granteeId',value)} options={catalog.grantees} disabled={disabled} placeholder="Use saved organization grantees"/>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-muted-foreground">Award date<input aria-label="Award date" type="date" value={selection.awardDate||''} disabled={disabled} onChange={event=>state.change('awardDate',event.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground"/></label>
      <label className="text-xs font-medium text-muted-foreground">Signature due date<input aria-label="Signature due date" type="date" value={selection.dueDate||''} disabled={disabled} onChange={event=>state.change('dueDate',event.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground"/><span className="mt-1 block font-normal">Leave blank for 30 days after the award date.</span></label>
    </div>
    <p className="text-xs text-muted-foreground">Draft packages include the GAN and, when needed, a Project Schedule. Special Conditions are required before signature routing.</p>
  </div>;
}
