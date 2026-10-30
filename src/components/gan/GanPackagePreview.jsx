import {lazy,Suspense} from 'react';
const GanPackagePdfViewer=lazy(()=>import('./GanPackagePdfViewer'));
import {ganRequiredReturnLabel} from '@/lib/documents/ganPackagePresentation';
import GanBatchButton from './GanBatchButton';
export default function GanPackagePreview({state,onRendered=null}) {
  const saved=state.selected;if(!saved)return null;
  return <section aria-label="Saved draft package" className="space-y-3 rounded-lg border bg-background p-4">
    <div><h3 className="font-semibold">Package r{saved.package.package_revision} · GAN r{saved.package.gan_revision}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{saved.manifest.application_number} · Subaward {saved.manifest.subaward_number} · {saved.manifest.pages} pages</p>
      <p className="mt-1 break-words text-xs text-muted-foreground">{saved.manifest.project_ids.join(', ')}</p></div>
    <ul className="space-y-1 text-sm">{saved.manifest.parts.map(part=><li key={part.kind}>{part.title}{part.source_version?' · v'+part.source_version:''} · pages {part.page_start}–{part.page_end}</li>)}</ul>
    <div><p className="text-sm font-medium">Required signed returns</p><ul className="mt-1 space-y-1 text-xs">{saved.manifest.required_returns.map(part=><li key={part.kind}>{ganRequiredReturnLabel(part)}</li>)}</ul></div>
    <div className="flex flex-wrap gap-2"><GanBatchButton outline onClick={state.preview} disabled={Boolean(state.busy)}>Preview package PDF</GanBatchButton>
      <GanBatchButton onClick={state.download} disabled={Boolean(state.busy)}>Download draft package PDF</GanBatchButton></div>
    {state.previewUrl&&<Suspense fallback={<p className="text-sm">Loading PDF viewer…</p>}><GanPackagePdfViewer key={state.previewUrl} url={state.previewUrl} onRendered={onRendered}/></Suspense>}
  </section>;
}
