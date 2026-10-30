import {useEffect} from 'react';
import GanBatchSelect from './GanBatchSelect';
import {useGanPackagePdfPage} from '@/hooks/useGanPackagePdfPage';
import GanBatchButton from './GanBatchButton';
export default function GanPackagePdfViewer({url,label='Draft award package PDF',onRendered=null}) {
  const state=useGanPackagePdfPage(url);
  useEffect(()=>{onRendered?.(!state.loading&&!state.error&&state.pages>0);},[state.loading,state.error,state.pages,onRendered]);
  return <section aria-label={label} className="space-y-3 rounded border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center gap-3"><GanBatchButton outline onClick={state.previous} disabled={state.loading||state.page<=1}>Previous PDF page</GanBatchButton>
      <p className="text-sm">Page {state.page} of {state.pages||'…'}</p><GanBatchButton outline onClick={state.next} disabled={state.loading||state.page>=state.pages}>Next PDF page</GanBatchButton>
      <GanBatchSelect label="PDF zoom" value={state.zoom} onChange={state.changeZoom} disabled={state.loading} options={[{id:'100',name:'Fit width'},{id:'150',name:'150%'},{id:'200',name:'200%'}]}/></div>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <p role="status" className="text-xs text-muted-foreground">{state.error?'PDF preview unavailable.':state.loading?'Rendering PDF page…':'PDF page '+state.page+' of '+state.pages+' rendered.'}</p>
    <div className="overflow-x-auto rounded border bg-white"><canvas ref={state.canvas} aria-label={label+' page '+state.page} role="img" className="block h-auto max-w-none" style={{width:state.zoom+'%'}}/></div>
  </section>;
}
