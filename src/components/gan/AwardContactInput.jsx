export default function AwardContactInput({label,value,onChange,type='text',disabled=false,readOnly=false}) {
  return <label className="block text-xs font-medium text-muted-foreground">{label}
    <input aria-label={label} type={type} value={value||''} onChange={event=>onChange(event.target.value)} disabled={disabled} readOnly={readOnly}
      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground read-only:bg-muted/40 disabled:opacity-60"/>
  </label>;
}
