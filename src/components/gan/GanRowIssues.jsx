import {ganSourceHref,ganIssueLabel} from '@/lib/documents/ganBatchPresentation';
export default function GanRowIssues({row}) {
  if(!row.issues.length&&!row.reason)return <span className="text-xs text-muted-foreground">—</span>;
  return <div className="max-w-sm text-xs">
    {row.reason&&<p className="mb-1">{row.reason}</p>}
    {row.issues.length>0&&<details><summary className="cursor-pointer text-amber-800">View {row.issues.length} correction{row.issues.length===1?'':'s'}</summary>
      <ul className="mt-2 space-y-2">{row.issues.map((issue,index)=><li key={index} className="border-l-2 border-amber-300 pl-2">
        <p><strong>{ganIssueLabel(issue)}:</strong> {issue.reason}</p>{issue.source?.screen&&<a className="text-blue-700 underline" href={ganSourceHref(issue.source.record)}>{issue.source.screen}</a>}
      </li>)}</ul>
    </details>}
  </div>;
}
