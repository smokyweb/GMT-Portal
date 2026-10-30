import {Button,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui';
export default function AccountBulkActions({state}) {
  if(!state.selected.size)return null;
  return <div className="flex gap-2 items-center p-2 bg-primary/5 rounded border border-primary/20">
    <span className="text-xs font-medium text-primary">{state.selected.size} selected</span>
    <Select value={state.bulkAction} onValueChange={value=>{state.setBulkAction(value);state.setBulkValue('');}}>
      <SelectTrigger className="w-36 h-7" aria-label="Bulk account action"><SelectValue placeholder="Bulk action"/></SelectTrigger>
      <SelectContent><SelectItem value="status">Change Status</SelectItem>
        {state.user?.role==='isc_admin'&&<SelectItem value="role">Change Role</SelectItem>}</SelectContent></Select>
    {state.bulkAction&&<Select value={state.bulkValue} onValueChange={state.setBulkValue}>
      <SelectTrigger className="w-40 h-7" aria-label="Bulk account value"><SelectValue placeholder={state.bulkAction==='status'?'Status':'Role'}/></SelectTrigger>
      <SelectContent>{(state.bulkAction==='status'?['active','inactive']:['user','reviewer','admin','isc_admin']).map(value=>
        <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}
    {state.bulkValue&&<Button size="sm" className="h-7" disabled={state.busy} onClick={state.applyBulk}>{state.busy?'Processing…':'Apply'}</Button>}
    <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={state.clearSelection} disabled={state.busy}>Cancel</Button>
  </div>;
}
