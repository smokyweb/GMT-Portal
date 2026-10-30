export default function GanSendIssues({issues=[]}) {
  if(!Array.isArray(issues)||!issues.length)return null;
  return <ul className="space-y-2 text-xs text-red-700">{issues.map((issue,index)=><li key={index} className="rounded border border-red-200 p-2"><strong>{issue.token}</strong>: {issue.reason}
    {issue.source?.screen&&<p className="mt-1">Correct in {issue.source.screen}, then regenerate and review the GAN.</p>}</li>)}</ul>;
}
