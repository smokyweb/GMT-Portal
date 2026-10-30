import {useState} from 'react';
import {useGanPackageEditor} from '@/hooks/useGanPackageEditor';
import GanBatchSelect from './GanBatchSelect';
import GanBatchButton from './GanBatchButton';
import GanAttachmentUpload from './GanAttachmentUpload';
import GanPackagePreview from './GanPackagePreview';
import GanSendPanel from './GanSendPanel';
export default function GanPackageEditor({nofoId,document,onClose}) {
  const [pdfRendered,setPdfRendered]=useState(false);
  const state=useGanPackageEditor(nofoId,document),locked=state.loading||Boolean(state.busy);
  return <section aria-label="Prepare award package" className="space-y-4 rounded-xl border bg-muted/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Prepare award package</h2>
      <p className="mt-1 text-sm text-muted-foreground">{state.record?.document.application_number||'Award'} · GAN r{document.revision}. Review attachments and signature pages before routing.</p></div>
      <GanBatchButton outline onClick={onClose} disabled={Boolean(state.busy)}>Close package</GanBatchButton></div>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.notice&&<p role="status" className="text-sm text-green-800">{state.notice}</p>}
    {state.loading&&<p role="status" className="text-sm">Loading package sources…</p>}{state.busy&&<p role="status" className="text-sm">{state.busy}</p>}
    {state.stale&&<p role="alert" className="text-sm text-amber-800">This GAN has a newer revision. Open the current draft before preparing another package.</p>}
    {!state.loading&&<>
      <div className="grid gap-4 sm:grid-cols-2"><GanBatchSelect label="Special Conditions version" value={state.conditionsId} onChange={id=>state.choose('conditions',id)} disabled={locked} options={state.conditions} placeholder="Choose required Special Conditions"/>
        <GanBatchSelect label="Optional Direct Deposit version" value={state.depositId} onChange={id=>state.choose('deposit',id)} disabled={locked} options={state.deposits} placeholder="Do not attach"/></div>
      {!state.conditions.length&&<p className="text-sm text-amber-800">Upload the approved Special Conditions and identify its signature pages before saving a package.</p>}
      <GanAttachmentUpload nofoId={nofoId} onUploaded={state.uploaded} disabled={locked}/>
      <GanBatchButton onClick={state.prepare} disabled={locked||!state.conditionsId||Boolean(state.stale)}>Save draft package</GanBatchButton>
      {state.history.length>0&&<GanBatchSelect label="Saved package history" value={state.selected?.package.id} onChange={state.view} disabled={locked}
        options={state.history.map(item=>({...item,label:'Package r'+item.package_revision+' · GAN r'+item.gan_revision}))}/>}
      <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {state.selected&&<GanSendPanel key={state.selected.package.id} documentId={document.id} packageId={state.selected.package.id} previewUrl={state.previewUrl} pdfRendered={pdfRendered}/>}
        <GanPackagePreview state={state} onRendered={setPdfRendered}/>
      </div>
    </>}
  </section>;
}
