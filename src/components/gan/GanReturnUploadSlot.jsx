import {useGanReturnFile} from '@/hooks/useGanReturnFile';
import {ganReturnTitle,ganReturnInputLabel} from '@/lib/documents/ganReturnPresentation';
import GanBatchButton from './GanBatchButton';
export default function GanReturnUploadSlot({part,upload,onUpload,onDownload,disabled}) {
  const state=useGanReturnFile(part,onUpload),title=ganReturnTitle(part.kind);
  return <section aria-label={title+' upload'} className="space-y-3 rounded border p-3">
    <h3 className="text-sm font-semibold">{title}{!part.required?' (optional)':''}</h3>
    <p className="text-xs text-muted-foreground">{part.required?'Required original signature pages: '+part.signaturePages.join(', '):'Optional return for this package.'}</p>
    {upload&&<div className="space-y-1 text-xs"><p className="break-all">{upload.filename} · v{upload.version} · original pages {upload.source_pages.join(', ')}</p>
      <button type="button" onClick={()=>onDownload(upload)} disabled={disabled} className="text-primary underline disabled:opacity-50">Download saved original</button></div>}
    <label className="block text-xs font-medium">{ganReturnInputLabel(part.kind)}<input ref={state.input} type="file" accept="application/pdf,.pdf" aria-label={ganReturnInputLabel(part.kind)} onChange={event=>state.setFile(event.target.files?.[0]||null)} disabled={disabled} className="mt-1 block w-full min-w-0 text-xs"/></label>
    <label className="block text-xs font-medium">Original pages included — {title}<input aria-label={'Original pages included — '+title} value={state.pages} onChange={event=>state.setPages(event.target.value)} disabled={disabled} className="mt-1 w-full rounded border bg-background p-2 text-sm"/></label>
    <p className="text-xs text-muted-foreground">List the original page numbers in the same order as this PDF. One number per uploaded page. PDF only, up to 10 MB.</p>
    <GanBatchButton outline onClick={state.save} disabled={disabled||!state.file}>Save {title} upload</GanBatchButton>
  </section>;
}
