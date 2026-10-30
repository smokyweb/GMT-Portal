import Button from './GanBatchButton';
export default function GanBatchActions({state}) {
  return <div className="flex flex-wrap items-center justify-end gap-2">
    {state.busy?<Button outline onClick={state.stop} disabled={!state.canStop}>{state.canStop?'Stop after current group':state.busy}</Button>:state.batch?<>
      <Button outline onClick={state.fresh}>Start a new batch</Button>
      {state.batch.counts.pending>0&&<Button onClick={()=>state.resume(false)}>Resume pending drafts</Button>}
      {(state.batch.counts.blocked>0||state.batch.counts.failed>0)&&<Button onClick={()=>state.resume(true)}>Retry unresolved rows</Button>}
    </>:<>
      <Button outline disabled={!state.canRun} onClick={state.check}>Preview selected</Button>
      <Button disabled={!state.canRun} onClick={state.generate}>Generate {state.selectedIds.length} selected drafts</Button>
    </>}
  </div>;
}
