import GanDraftActions from './GanDraftActions';
import GanRowIssues from './GanRowIssues';
export default function GanBatchRows({state}) {
  const locked=Boolean(state.batch||state.busy);
  return <div className="overflow-x-auto rounded-lg border bg-card">
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>
        <th className="p-3"><input aria-label="Select all applications" type="checkbox" checked={state.allSelected} disabled={locked} onChange={state.toggleAll}/></th>
        <th className="p-3">Application # / Subrecipient</th><th className="p-3">Projects</th><th className="p-3">Award</th><th className="p-3">Readiness</th><th className="p-3">Corrections / Draft</th>
      </tr></thead>
      <tbody>{state.rows.map(row=><tr key={row.applicationId} className="border-t align-top">
        <td className="p-3"><input aria-label={'Select '+row.applicationNumber} type="checkbox" checked={row.selected} disabled={locked} onChange={()=>state.toggle(row.applicationId)}/></td>
        <td className="p-3"><p className="font-medium">{row.applicationNumber||'Application'}</p><p className="mt-1 text-xs text-muted-foreground">{row.organizationName||'Organization unavailable'}</p></td>
        <td className="p-3"><span className="whitespace-nowrap rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-800">{row.projectLabel}</span></td>
        <td className="whitespace-nowrap p-3">{row.awardLabel}</td>
        <td className="p-3"><span className={'inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs '+(row.state==='Ready'||row.state==='Draft saved'?'bg-green-50 text-green-800':row.state==='Not checked'?'bg-muted text-muted-foreground':'bg-amber-50 text-amber-900')}>{row.state}</span></td>
        <td className="p-3">{row.pdfDocument?<GanDraftActions document={row.pdfDocument} onDownload={state.download} onPackage={state.showPackage}/>:<GanRowIssues row={row}/>}</td>
      </tr>)}</tbody>
    </table>
    {!state.rows.length&&<p className="p-8 text-center text-sm text-muted-foreground">Choose a NOFO to view its applications.</p>}
  </div>;
}
