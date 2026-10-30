import {useGanReturnDownloads} from '@/hooks/useGanReturnDownloads';
import {ganReturnTitle} from '@/lib/documents/ganReturnPresentation';
import GanReturnHistoryRow from './GanReturnHistoryRow';
export default function GanReturnHistory({returns}) {
  const state=useGanReturnDownloads();
  if(!returns?.uploads.length)return null;
  return <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Signed upload history</summary>
    <div className="mt-4 space-y-4">{returns.submissions.length>0&&<section aria-label="Submitted copy history"><h3 className="text-sm font-medium">Submitted copies</h3><ul className="mt-2">
      {returns.submissions.map(row=><GanReturnHistoryRow key={row.id} label={'Submitted copy '+row.submission_number} onDownload={()=>state.download(row)} disabled={state.busy}/>)}</ul></section>}
      <section aria-label="Original file history"><h3 className="text-sm font-medium">Original file versions</h3><ul className="mt-2">{returns.uploads.map(row=><GanReturnHistoryRow key={row.id} label={ganReturnTitle(row.kind)+' · v'+row.version+' · '+row.filename} onDownload={()=>state.download(row,true)} disabled={state.busy}/>)}</ul></section>
    </div>{state.error&&<p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
  </details>;
}
