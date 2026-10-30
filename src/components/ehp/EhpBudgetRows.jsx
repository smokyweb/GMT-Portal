export default function EhpBudgetRows({context,busy,onClassify}) {
  return <div className="space-y-2">
    <p className="text-xs font-semibold">Affected budget lines</p>
    {!context.budgets.length&&<p className="text-xs text-muted-foreground">No application budget lines are recorded.</p>}
    {context.budgets.map(line=><div key={line.id} className="flex flex-wrap items-center gap-2 border rounded p-2 text-xs">
      <span className="flex-1 min-w-32">{line.budget_category} · {line.line_description}</span>
      <select aria-label={'EHP classification: '+line.line_description} value={line.ehp_affected==null?'':String(line.ehp_affected)} disabled={!context.can_edit||busy}
        onChange={event=>onClassify(line.id,event.target.value==='true')} className="rounded border bg-background p-1">
        <option value="" disabled>Needs classification</option><option value="true">Affected by EHP</option><option value="false">Not affected by EHP</option>
      </select>
    </div>)}
    <p className="text-xs text-muted-foreground">Affected costs require recorded EHP approval before reimbursement. Other classified costs can proceed. Changing a classification reopens any required EHP review.</p>
  </div>;
}
