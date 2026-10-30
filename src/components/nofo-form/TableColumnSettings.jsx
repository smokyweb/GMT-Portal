import {FIELD_TYPE_LABELS} from '@/lib/forms/formPresentation';
import {formId} from '@/lib/forms/formEditing';
export default function TableColumnSettings({field,onChange}) {
  const set=(index,changes)=>onChange({columns:field.columns.map((column,i)=>i===index?{...column,...changes}:column)});
  return <fieldset className="border rounded p-2 space-y-2"><legend className="text-xs font-semibold">Repeating table columns</legend>
    {(field.columns||[]).map((column,index)=><div key={column.id} className="space-y-1 border-b pb-2">
      <div className="flex gap-2"><input aria-label={'Column '+(index+1)+' label'} className="border rounded p-1 w-full bg-background text-xs" value={column.label} onChange={e=>set(index,{label:e.target.value})}/>
        <select aria-label={'Column '+(index+1)+' type'} className="border rounded p-1 bg-background text-xs" value={column.type} onChange={e=>set(index,{type:e.target.value})}>{['text','longtext','number','currency','date','checkbox','yesno','dropdown'].map(type=><option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}</select></div>
      <div className="flex gap-2 items-center text-xs"><label className="flex gap-1"><input type="checkbox" checked={column.required} onChange={e=>set(index,{required:e.target.checked})}/>Required</label>
        {['number','currency'].includes(column.type)&&['min','max'].map(key=><input key={key} aria-label={'Column '+(index+1)+' '+key} type="number" placeholder={key} className="w-16 border rounded p-1 bg-background" value={column[key]??''} onChange={e=>set(index,{[key]:e.target.value===''?undefined:Number(e.target.value)})}/>)}
        <button type="button" aria-label={'Remove column '+(index+1)} onClick={()=>onChange({columns:field.columns.filter((_,i)=>i!==index)})} className="text-red-700 ml-auto">Remove</button></div>
      {['yesno','dropdown'].includes(column.type)&&<input aria-label={'Column '+(index+1)+' choices'} placeholder="Choices separated by commas" className="w-full border rounded p-1 bg-background text-xs" value={(column.options||[]).join(',')} onChange={e=>set(index,{options:e.target.value.split(',').map(value=>value.trim())})}/>}
    </div>)}
    <button type="button" className="text-xs text-primary" onClick={()=>onChange({columns:[...(field.columns||[]),{id:formId('column'),label:'New column',type:'text',required:false}]})}>+ Add column</button>
  </fieldset>;
}
