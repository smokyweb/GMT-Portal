export default function FormSections({state}) {
  return <div className="space-y-2"><p className="text-xs font-semibold uppercase text-muted-foreground">Sections</p>
    {state.definition.sections.map((section,index)=><div key={section.id} className={'border rounded-lg p-2 space-y-2 '+(section.id===state.section.id?'border-primary bg-primary/5':'')}>
      <button type="button" className="text-left text-sm font-medium w-full" onClick={()=>state.chooseSection(section.id)}>{section.label}</button>
      <div className="flex items-center gap-2 text-xs"><label className="flex gap-1 items-center"><input type="checkbox" aria-label={'Enable '+section.label} checked={section.enabled} disabled={section.kind==='review'} onChange={e=>state.change({...state.definition,sections:state.definition.sections.map(item=>item.id===section.id?{...item,enabled:e.target.checked}:item)})}/>On</label>
        <button type="button" aria-label={'Move '+section.label+' up'} disabled={index===0||section.kind==='review'} onClick={()=>state.moveSection(index,-1)} className="ml-auto disabled:opacity-30">↑</button>
        <button type="button" aria-label={'Move '+section.label+' down'} disabled={index>=state.definition.sections.length-2} onClick={()=>state.moveSection(index,1)} className="disabled:opacity-30">↓</button></div>
    </div>)}
    <button type="button" onClick={state.addSection} className="w-full rounded border p-2 text-sm">+ Add Section</button>
  </div>;
}
