import AwardValueInput from './AwardValueInput';
export default function AwardFieldRow({field,state}) {
  const award=state.context.award;
  return <div>
    <label htmlFor={'award-'+field.key} className="text-xs font-medium">{field.label}</label>
    <AwardValueInput field={field} value={state.fields[field.key]} onChange={value=>state.setField(field.key,value)} disabled={!state.context.can_edit||state.busy}/>
    <div className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
      <span>{award.origins[field.key]||'Award'}{award.origins[field.key]?.startsWith('from ')?' · saved snapshot':''}</span>
      {field.inherited&&state.context.can_edit&&<button type="button" disabled={state.busy} onClick={()=>state.restore(field.key)} className="text-primary underline">Use current source</button>}
    </div>
  </div>;
}
