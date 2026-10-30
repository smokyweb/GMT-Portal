import AwardValueInput from './AwardValueInput';
export default function NofoFederalIdentifiers({form,onChange}) {
  return <div className="grid sm:grid-cols-3 gap-3">
    {[{key:'title',label:'Title'},{key:'grant_number',label:'Federal Grant Number (FAIN)'},{key:'state_grant_number',label:'State Grant Number'}].map(field=><div key={field.key}>
      <label htmlFor={'award-'+field.key} className="text-xs font-medium">{field.label}</label>
      <AwardValueInput field={field} value={form[field.key]} onChange={value=>onChange(field.key,value)}/>
    </div>)}
    <p className="sm:col-span-3 text-xs text-muted-foreground">FAIN format: EMK-2026-EP-05006. The existing Grant Number value stays in this field.</p>
  </div>;
}
