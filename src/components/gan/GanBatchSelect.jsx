export default function GanBatchSelect({label,value,onChange,options,disabled=false,placeholder='Choose…'}) {
  return <label className="block min-w-0 text-xs font-medium text-muted-foreground">{label}
    <select aria-label={label} value={value||''} onChange={event=>onChange(event.target.value)} disabled={disabled}
      className="mt-1 block w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground disabled:opacity-60">
      <option value="">{placeholder}</option>{options.map(option=><option key={option.id} value={option.id}>{option.label||option.name||option.title}</option>)}
    </select>
  </label>;
}
