import {TabsContent} from '@/components/ui/tabs';
import AwardDetailsPanel from './AwardDetailsPanel';
const Content=/** @type {import('react').ComponentType<any>} */(TabsContent);
export default function AwardDetailsTabContent({applicationId,onUpdate=(_application)=>{}}) {
  return <Content value="award-details"><AwardDetailsPanel applicationId={applicationId} onUpdate={onUpdate}/></Content>;
}
