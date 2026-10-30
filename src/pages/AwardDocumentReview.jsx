import GanReturnHistory from '@/components/gan/GanReturnHistory';
import GanPackageEditor from '@/components/gan/GanPackageEditor';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import {useGanWorkflow} from '@/hooks/useGanWorkflow';
import {ganPhaseLabel} from '@/lib/documents/ganWorkflowPresentation';
import GanWorkflowIdentifiers from '@/components/gan/GanWorkflowIdentifiers';
import GanReviewDocuments from '@/components/gan/GanReviewDocuments';
import {useGanReturnReview} from '@/hooks/useGanReturnReview';
import GanUploadVerification from '@/components/gan/GanUploadVerification';
import GanRecipientActions from '@/components/gan/GanRecipientActions';
import GanWorkflowActivity from '@/components/gan/GanWorkflowActivity';
export default function AwardDocumentReview() {
  const {id}=useParams(),{user}=useAuth(),state=useGanWorkflow(id),record=state.record,review=useGanReturnReview(record);
  return <main className="max-w-7xl space-y-5">
    <Link to="/award-documents" className="text-sm text-primary underline">Back to Award Documents</Link>
    <header className="space-y-2"><h1 className="text-2xl font-bold">Grant Award Notice — {user?.role==='user'?'Review & Sign':'Award activity'}</h1>
      {record?.manifest&&<GanWorkflowIdentifiers values={record.manifest.values} projects={record.manifest.projects}/>}
      {record&&<p className="text-sm font-medium">{ganPhaseLabel(record.phase)}</p>}</header>
    {state.busy&&<p role="status" className="text-sm">{state.busy}</p>}{state.error&&<p role="alert" className="rounded border border-red-200 p-3 text-sm text-red-700">{state.error}</p>}
    {state.notice&&<p role="status" className="rounded border border-green-200 p-3 text-sm text-green-800">{state.notice}</p>}
    {record?.issue&&<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><GanReviewDocuments workflow={state} review={review}/>
      <aside className="space-y-4">{user?.role==='user'&&<GanRecipientActions key={record.issue.id} workflow={state}/>}{['admin','reviewer','isc_admin'].includes(user?.role)&&<GanUploadVerification key={record.issue.id} workflow={state} review={review}/>}<GanReturnHistory returns={record.returns}/><GanWorkflowActivity events={record.events}/></aside></div>}
    {
      record&&!record.issue&&['admin','isc_admin'].includes(user?.role)&&<GanPackageEditor key={record.document.id} nofoId={record.document.nofo_id} document={{id:record.document.id,revision:record.document.gan_revision}} onClose={()=>window.history.back()}/>
    }
  </main>;
}
