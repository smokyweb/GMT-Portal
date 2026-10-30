const classes='mt-1 w-full border rounded-md px-3 py-2 bg-background text-sm';
export default function SimpleFieldInput({field,value,onChange,label=undefined,readOnly=false,disabled=false}) {
  const common={id:field.id,'aria-label':label||field.label,disabled,value:value??'',onChange:event=>onChange(event.target.value),className:classes};
  if(readOnly)return <input {...common} readOnly className={classes+' bg-muted/30'} onChange={undefined}/>;
  if(field.type==='longtext')return <textarea {...common} rows={4} maxLength={field.maxLength||100000}/>;
  if(field.type==='checkbox')return <input id={field.id} aria-label={label||field.label} type="checkbox" disabled={disabled} checked={value===true} onChange={event=>onChange(event.target.checked)} className="ml-2"/>;
  if(['dropdown','yesno'].includes(field.type))return <select {...common}><option value="">Select…</option>{(field.options||[]).map(option=><option key={option} value={option}>{field.optionLabels?.[option]|| (option==='unknown'?'Unsure':option==='yes'?'Yes':option==='no'?'No':option)}</option>)}</select>;
  return <input {...common} type={['number','currency'].includes(field.type)?'number':field.type==='date'?'date':'text'} min={field.min} max={field.max} step={field.type==='currency'?'0.01':field.type==='number'?'any':undefined} maxLength={field.maxLength} value={field.type==='date'?String(value||'').slice(0,10):value??''}/>;
}
