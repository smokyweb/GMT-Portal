export default function EhpHistory({history}) {
  if(!history.length)return null;
  return <details className="text-xs"><summary className="cursor-pointer">EHP decision history ({history.length})</summary>
    <ol className="mt-2 space-y-2">{history.map(item=><li key={item.id} className="border rounded p-2">
      <p className="font-medium">{item.decision==='Approved'?'Approval recorded':'Review reopened'} · {item.approval_reference||'Review notes'}</p>
      <p>{item.recorded_by} · {new Date(item.recorded_at).toLocaleString()}</p>
      {item.approval_date&&<p>Approval date: {String(item.approval_date).slice(0,10)}</p>}{item.notes&&<p className="whitespace-pre-wrap">{item.notes}</p>}
    </li>)}</ol>
  </details>;
}
