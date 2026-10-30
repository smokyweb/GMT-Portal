import {FIELD_TYPE_LABELS} from '@/lib/forms/formPresentation';
export default function FormFields({state}) {
  return <div className="space-y-3">
    <label className="text-xs font-medium">Section name<input aria-label="Section name" className="block border rounded p-2 w-full bg-background text-sm mt-1" value={state.section.label} onChange={e=>state.setSection({label:e.target.value})}/></label>
    {['organization','budget','documents','review'].includes(state.section.kind)&&<p className="text-xs text-muted-foreground">This section also uses the portal's {state.section.kind} controls.</p>}
    <div className="space-y-2">{state.section.fields.map((field,index)=><div key={field.id} className={'rounded border p-2 space-y-2 '+(state.fieldId===field.id?'border-primary':'')}>
      <div className="flex items-center gap-2"><button type="button" onClick={()=>state.setFieldId(field.id)} className="text-sm font-medium text-left flex-1">{field.label}</button>
        <button type="button" aria-label={'Move '+field.label+' up'} disabled={index===0} onClick={()=>state.moveField(index,-1)} className="disabled:opacity-30 text-xs">↑</button>
        <button type="button" aria-label={'Move '+field.label+' down'} disabled={index===state.section.fields.length-1} onClick={()=>state.moveField(index,1)} className="disabled:opacity-30 text-xs">↓</button></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex gap-1 items-center"><input type="checkbox" aria-label={'Show '+field.label} checked={field.visible} onChange={e=>{state.setFieldId(field.id);state.change({...state.definition,sections:state.definition.sections.map(section=>section.id===state.section.id?{...section,fields:section.fields.map(item=>item.id===field.id?{...item,visible:e.target.checked}:item)}:section)})}}/>Show</label>
        <span>{field.required?'Required':'Optional'} · {FIELD_TYPE_LABELS[field.type]}</span>
        <button type="button" aria-label={'Settings for '+field.label} onClick={()=>state.setFieldId(field.id)} className="text-primary ml-auto">Settings</button>
        {field.source==='custom'&&<button type="button" aria-label={'Delete '+field.label} onClick={()=>state.deleteField(field)} className="text-red-700">Delete</button>}
      </div></div>)}</div>
    <button type="button" onClick={state.addField} className="rounded border px-3 py-2 text-sm">+ Add Custom Field</button>
  </div>;
}
