import {useGanSignatureForm} from '@/hooks/useGanSignatureForm';
import AwardContactInput from './AwardContactInput';
import GanConsentCheckbox from './GanConsentCheckbox';
import GanBatchButton from './GanBatchButton';
import GanRejectForm from './GanRejectForm';
export default function GanSignaturePanel({workflow,rejectOnly=false}) {
  const state=useGanSignatureForm(workflow),{record,busy,rendered}=workflow;
  const locked=Boolean(busy)||!record.canAct||record.phase!=='Reviewed'||!rendered,electronic=!rejectOnly&&record.issue.allowed_methods.includes('electronic');
  return <section aria-label={rejectOnly?'Reject this award':'Sign this award'} className="space-y-4 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">{rejectOnly?'Reject this award':'Sign this award'}</h2>
    <p className="text-xs text-muted-foreground">{rejectOnly?'Reject if the issuing team needs to change the GAN itself.':'Your registered identity, signature time and observed IP address are recorded with your consent.'}</p>
    <p className="text-xs">Assigned official: <strong>{record.issue.recipient_name}</strong></p>
    {!rendered&&record.canAct&&<p className="text-sm text-amber-800">Load and review the PDF before signing or rejecting.</p>}
    {!record.canAct&&<p role="status" className="text-sm">This issue is no longer awaiting your signature.</p>}
    {electronic&&record.canAct&&<>
      <AwardContactInput label="Full name" value={state.form.name} onChange={value=>state.change('name',value)} disabled={locked}/>
      <AwardContactInput label="Title" value={state.form.title} onChange={value=>state.change('title',value)} disabled={locked}/>
      {Object.entries(record.consents).map(([key,label])=><GanConsentCheckbox key={key} label={label} checked={state.form[key]} onChange={value=>state.change(key,value)} disabled={locked}/>)}
    </>}
    {!electronic&&!rejectOnly&&record.canAct&&<p className="text-sm">This template requires a signed upload. Upload and verification are not available in this staged version yet.</p>}
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {record.canAct&&!state.rejecting&&<div className="flex flex-wrap gap-2">{electronic&&<GanBatchButton onClick={state.sign} disabled={locked}>Sign award</GanBatchButton>}
      <GanBatchButton outline onClick={()=>state.setRejecting(true)} disabled={locked}>Reject…</GanBatchButton></div>}
    {record.canAct&&state.rejecting&&<GanRejectForm state={state} disabled={locked}/>}
    {record.phase==='RecipientSigned'&&<p className="text-sm text-amber-800">Awaiting NEMA verification and countersignature. The award is not fully executed.</p>}
  </section>;
}
