import {useApplicationDocuments} from '@/hooks/useApplicationDocuments';
import RequiredApplicationDocuments from './application-form/RequiredApplicationDocuments';
import SupportingApplicationDocuments from './application-form/SupportingApplicationDocuments';
export default function ApplicationDocumentsStep(props) {
  const state=useApplicationDocuments(props);
  return <div className="space-y-5">
    {state.error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    <RequiredApplicationDocuments state={state}/><SupportingApplicationDocuments state={state}/>
  </div>;
}
