export default function AwardValueInput({field,value,onChange,disabled=false}) {
  const shared={id:'award-'+field.key,'aria-label':field.label,disabled,className:'mt-1 w-full rounded border bg-background px-3 py-2 text-sm'};
  if(field.type==='select')return <select {...shared} value={value??''} onChange={e=>onChange(e.target.value)}>{(field.options||[]).map(option=><option key={option}>{option}</option>)}</select>;
  if(field.type==='textarea')return <textarea {...shared} value={value??''} onChange={e=>onChange(e.target.value)} rows={3}/>;
  if(field.type==='boolean')return <select {...shared} value={value==null?'':String(value)} onChange={e=>onChange(e.target.value===''?null:e.target.value==='true')}><option value="">Not specified</option><option value="false">No</option><option value="true">Yes</option></select>;
  const type=field.type==='date'?'date':['money','percent','year'].includes(field.type)?'number':'text';
  return <input {...shared} type={type} min={type==='number'?0:undefined} step={field.type==='money'?'0.01':field.type==='percent'?'0.0001':field.type==='year'?'1':undefined} value={value??''} onChange={e=>onChange(e.target.value)}/>;
}
