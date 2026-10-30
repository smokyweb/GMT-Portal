import GanBatchButton from './GanBatchButton';
export default function GanSigningMethodChoice({value,onChange,methods,disabled}) {
  return <section aria-label="Signing method" className="space-y-3 rounded-lg border bg-card p-4"><h2 className="font-semibold">How would you like to sign?</h2>
    <div className="flex flex-wrap gap-2">{methods.includes('electronic')&&<GanBatchButton outline={value!=='electronic'} onClick={()=>onChange('electronic')} disabled={disabled}>Sign in the portal</GanBatchButton>}
      {methods.includes('upload')&&<GanBatchButton outline={value!=='upload'} onClick={()=>onChange('upload')} disabled={disabled}>Print, sign &amp; upload</GanBatchButton>}</div>
  </section>;
}
