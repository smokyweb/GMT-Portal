import GanConsentCheckbox from './GanConsentCheckbox';
export default function GanVerificationChecklist({checks,state,disabled}) {
  return <fieldset className="space-y-3" disabled={disabled}><legend className="mb-3 font-semibold">Verification checklist</legend>
    {Object.entries(checks).map(([key,label])=><GanConsentCheckbox key={key} label={label} checked={state.form.checklist[key]===true} onChange={value=>state.check(key,value)} disabled={disabled}/>)}
  </fieldset>;
}
