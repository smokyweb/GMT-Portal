export default function GanConsentCheckbox({label,checked,onChange,disabled}) {
  return <label className="flex items-start gap-2 text-sm leading-5"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 shrink-0"/><span>{label}</span></label>;
}
