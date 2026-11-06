export default function FundingLineEhp({line,index,context,error,onChange}) {
  const budgets = context?.budgets || [];
  const selectedBudget = budgets.find(item => item.id === line.application_budget_id);

  return <div className="space-y-2 rounded border p-3 text-xs">
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    <label className="block">Application budget line
      <select aria-label={'Application budget line for item '+(index+1)} value={line.application_budget_id||''} onChange={e=>onChange('application_budget_id',e.target.value)} className="mt-1 w-full rounded border bg-background p-2">
        <option value="">Select application budget line</option>{budgets.map(item=><option key={item.id} value={item.id}>{item.budget_category} · {item.line_description || 'Budget line'}{item.ael_number ? ` · AEL ${item.ael_number}` : ''} ({item.ehp_affected===true?'EHP affected':item.ehp_affected===false?'not EHP affected':'EHP classification pending'})</option>)}
      </select>
      {selectedBudget && <p className="mt-1 break-words text-[11px] text-muted-foreground">{selectedBudget.budget_category} · {selectedBudget.line_description || 'Budget line'}{selectedBudget.ael_number ? ` · AEL ${selectedBudget.ael_number}` : ''}</p>}
    </label>
    {!budgets.length&&<label className="block">Is this cost affected by EHP?
      <select aria-label={'EHP affected cost for item '+(index+1)} value={line.ehp_affected==null?'':String(line.ehp_affected)} onChange={e=>onChange('ehp_affected',e.target.value==='true')} className="mt-1 w-full rounded border bg-background p-2">
        <option value="">Choose classification</option><option value="true">Yes</option><option value="false">No</option>
      </select>
    </label>}
    {context?.required&&context.application.ehp_status!=='Approved'&&<p className="text-amber-800">EHP approval is pending. Affected costs must wait; budget lines classified as not affected can proceed.</p>}
  </div>;
}
