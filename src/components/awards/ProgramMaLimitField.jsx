export default function ProgramMaLimitField({value,onChange}) {
  return <label className="block text-sm">Maximum M&A Retained (%)
    <input aria-label="Program M&A limit" type="number" min="0" max="100" step="0.0001" value={value??''} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded border bg-background px-3 py-2"/>
    <span className="mt-1 block text-xs text-muted-foreground">Configured limit used to validate each NOFO's M&A retained percentage.</span>
  </label>;
}
