import AwardContactInput from './AwardContactInput';
import GanConsentCheckbox from './GanConsentCheckbox';
export default function GanReturnSignerFields({state,disabled}) {
  return <div className="space-y-3">
    <AwardContactInput label="Signed by — full name" value={state.form.name} onChange={value=>state.change('name',value)} disabled={disabled}/>
    <AwardContactInput label="Signer title" value={state.form.title} onChange={value=>state.change('title',value)} disabled={disabled}/>
    <AwardContactInput label="Date signed" type="date" value={state.form.signedDate} onChange={value=>state.change('signedDate',value)} disabled={disabled}/>
    <GanConsentCheckbox label="I confirm the uploaded pages are the complete, signed award documents." checked={state.form.confirmed} onChange={value=>state.change('confirmed',value)} disabled={disabled}/>
  </div>;
}
