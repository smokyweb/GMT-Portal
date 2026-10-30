import {TabsTrigger} from '@/components/ui/tabs';
// The shared JavaScript Radix wrapper omits its public prop types.
const Trigger=/** @type {import('react').ComponentType<any>} */(TabsTrigger);
export default function AwardDetailsTabTrigger() {
  return <Trigger value="award-details">Award Details</Trigger>;
}
