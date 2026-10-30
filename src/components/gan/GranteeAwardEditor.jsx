import {useGanContactSettings} from '@/hooks/useGanContactSettings';
import GanBatchButton from './GanBatchButton';
import GranteeAwardFields from './GranteeAwardFields';
import AwardContactMessages from './AwardContactMessages';
export default function GranteeAwardEditor({granteeId}) {
  const state=useGanContactSettings('grantee',granteeId);
  return <div className="space-y-4">
    <AwardContactMessages state={state}/>{state.loading&&<p className="text-sm text-muted-foreground">Loading grantee award settings…</p>}
    {state.context&&<><GranteeAwardFields state={state}/><div className="flex flex-wrap gap-2">
      <GanBatchButton disabled={state.busy} onClick={state.save}>{state.busy?'Saving…':'Save grantee award settings'}</GanBatchButton>
      <GanBatchButton outline disabled={state.busy} onClick={state.reload}>Reload settings</GanBatchButton>
    </div></>}
  </div>;
}
