import {lazy,Suspense} from 'react';
import GanBatchButton from './GanBatchButton';
const GanPackagePdfViewer=lazy(()=>import('./GanPackagePdfViewer'));
export default function GanUploadedPdf({review}) {
  return <section aria-label="Uploaded signed documents" className="min-w-0 space-y-3">
    <p className="text-sm">Submitted copy {review.submission.submission_number} · Original uploaded files are preserved separately. Compare every required page with the generated package.</p>
    <div className="flex flex-wrap gap-2"><GanBatchButton outline onClick={review.load} disabled={Boolean(review.busy)}>Reload uploaded PDF</GanBatchButton><GanBatchButton outline onClick={review.download} disabled={Boolean(review.busy)}>Download submitted PDF</GanBatchButton></div>
    {review.busy&&<p role="status" className="text-sm">{review.busy}</p>}{review.error&&<p role="alert" className="text-sm text-red-700">{review.error}</p>}
    {review.url&&<Suspense fallback={<p role="status">Loading uploaded PDF viewer…</p>}><GanPackagePdfViewer key={review.url} url={review.url} label="Uploaded signed copy PDF" onRendered={review.setRendered}/></Suspense>}
  </section>;
}
