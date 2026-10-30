import FundingLineEhp from './FundingLineEhp';
export default function CsvFundingEhpMapping({rows,context,error,onChange}) {
  return <section className="space-y-2" aria-label="CSV budget and EHP mapping">
    <h3 className="text-sm font-semibold">Budget and EHP mapping</h3>
    {rows.map((row,index)=><div key={index} className="space-y-1">
      <p className="text-xs font-medium">Row {row._index}: {row.description}</p>
      <FundingLineEhp line={row} index={index} context={context} error={error} onChange={(field,value)=>onChange(index,field,value)} />
    </div>)}
  </section>;
}
