export default function AwardContactMessages({state}) {
  return <>{state.error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.notice&&<p role="status" className="text-sm text-green-800">{state.notice}</p>}
    {state.context?.warnings?.map((warning,index)=><p key={index} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}</>;
}
