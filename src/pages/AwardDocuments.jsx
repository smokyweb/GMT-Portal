import {Navigate,useNavigate} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import GanBatchWorkspace from '@/components/gan/GanBatchWorkspace';
import GanWorkflowCatalog from '@/components/gan/GanWorkflowCatalog';
export default function AwardDocuments() {
  const {user}=useAuth(),navigate=useNavigate();
  if(!user)return null;
  if(!['admin','isc_admin','reviewer','user'].includes(user.role))return <Navigate to="/" replace/>;
  return <main className="max-w-7xl space-y-6">
    {['user','reviewer'].includes(user.role)&&<h1 className="text-2xl font-bold">Award Documents</h1>}
    <GanWorkflowCatalog/>
    {['admin','isc_admin'].includes(user.role)&&<GanBatchWorkspace standalone onClose={()=>navigate('/document-templates')}/>}
  </main>;
}
