import {lazy,Suspense} from 'react';
import GanBatchButton from './GanBatchButton';
const GanPackagePdfViewer=lazy(()=>import('./GanPackagePdfViewer'));
export default function GanIssuedPdf({workflow}) {
  return <section aria-label="Issued award package" className="min-w-0 space-y-3">
    <div className="flex flex-wrap gap-2"><GanBatchButton outline onClick={workflow.preview} disabled={Boolean(workflow.busy)}>Reload award PDF</GanBatchButton>
      <GanBatchButton outline onClick={workflow.download} disabled={Boolean(workflow.busy)}>Download award PDF</GanBatchButton></div>
    {workflow.previewUrl&&<Suspense fallback={<p role="status">Loading PDF viewer…</p>}><GanPackagePdfViewer key={workflow.previewUrl} url={workflow.previewUrl} label="Award package PDF" onRendered={workflow.setRendered}/></Suspense>}
  </section>;
}
