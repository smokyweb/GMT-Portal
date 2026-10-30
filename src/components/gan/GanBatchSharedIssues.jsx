import {ganSourceHref,ganIssueLabel} from '@/lib/documents/ganBatchPresentation';
export default function GanBatchSharedIssues({issues}) {
  if(!issues.length)return null;
  return <aside aria-label="Shared source corrections" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <p className="font-semibold">Shared source corrections</p><p className="mt-1 text-xs">Update these source records once, then check the affected awards again.</p>
    <ul className="mt-2 space-y-1">{issues.map((issue,index)=><li key={index}><strong>{ganIssueLabel(issue)}:</strong> {issue.reason} <a className="underline" href={ganSourceHref(issue.source.record)}>{issue.source.screen}</a></li>)}</ul>
  </aside>;
}
