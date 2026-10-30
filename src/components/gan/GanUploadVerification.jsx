import {useGanUploadVerification} from '@/hooks/useGanUploadVerification';
import GanVerificationChecklist from './GanVerificationChecklist';
import GanBatchButton from './GanBatchButton';
export default function GanUploadVerification({workflow,review}) {
  const state=useGanUploadVerification(workflow,review),record=workflow.record,locked=Boolean(workflow.busy||review.busy)||!record.returns?.canVerify||!workflow.rendered||!review.rendered;
  if(!record.returns||!record.returns.submissions.length)return null;
  return <section aria-label="NEMA upload verification" className="space-y-4 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">Verify signed GAN</h2>
    {record.returns.canVerify&&!workflow.rendered&&<p className="text-sm text-amber-900">Load the generated package before verification.</p>}
    {record.returns.canVerify&&!review.rendered&&<p className="text-sm text-amber-900">Open the uploaded signed copy and compare it with the generated package before verification.</p>}
    <GanVerificationChecklist checks={record.returns.checklist} state={state} disabled={locked}/>
    <label className="block text-sm font-medium">Verification or correction notes<textarea aria-label="Verification or correction notes" value={state.form.note} onChange={event=>state.note(event.target.value)} maxLength={4000} rows={4} disabled={locked} className="mt-2 w-full rounded border bg-background p-2 text-sm"/></label>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {record.returns.canVerify&&<div className="flex flex-wrap gap-2"><GanBatchButton onClick={state.accept} disabled={locked}>Accept signed copy</GanBatchButton>
      <GanBatchButton outline onClick={state.returnCopy} disabled={locked||!state.form.note.trim()}>Return for correction</GanBatchButton></div>}
    {record.phase==='Verified'&&<p role="status" className="text-sm text-amber-900">Signed uploads verified. Awaiting Assistant Director countersignature; this award is not fully executed.</p>}
    {record.phase==='UploadReturned'&&<p role="status" className="text-sm">Returned to the assigned official for correction.</p>}
  </section>;
}
