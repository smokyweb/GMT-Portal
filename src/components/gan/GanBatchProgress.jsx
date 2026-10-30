export default function GanBatchProgress({batch}) {
  if(!batch)return null;
  return <div role="status" className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
    <span className="font-medium">Template v{batch.templateVersion}</span><span>{batch.counts.generated} {batch.counts.generated===1?'draft':'drafts'} saved</span>
    <span>{batch.counts.pending} pending</span><span>{batch.counts.blocked} blocked</span><span>{batch.counts.failed} need retry</span>
  </div>;
}
