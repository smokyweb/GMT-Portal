import {GRANTEE_CONTACT_INPUTS} from '@/lib/documents/ganSettingsPresentation';
import GanBatchSelect from './GanBatchSelect';
import AwardContactInput from './AwardContactInput';
export default function GranteeAwardFields({state}) {
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">{GRANTEE_CONTACT_INPUTS.map(field=><AwardContactInput key={field.key} label={field.label} value={state.form[field.key]} type={field.type||'text'} disabled={state.busy} onChange={value=>state.field(field.key,value)}/>)}</div>
    <GanBatchSelect label="Portal approving official" value={state.form.approving_official_id} onChange={state.approver} disabled={state.busy}
      options={state.context.choices.approvers} placeholder="Print-only details / not assigned"/>
    <p className="text-xs text-muted-foreground">Select a registered agency administrator for portal countersignature, or leave it unassigned and enter the named official for print-and-upload. These settings apply to new drafts.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <AwardContactInput label="Approving official name" value={state.form.approving_official_name} onChange={value=>state.field('approving_official_name',value)} disabled={state.busy} readOnly={Boolean(state.form.approving_official_id)}/>
      <AwardContactInput label="Approving official title on GAN" value={state.form.approving_official_title} onChange={value=>state.field('approving_official_title',value)} disabled={state.busy}/>
    </div>
  </div>;
}
