import {useState} from 'react';
export default function FormCopyControls({state}) {
  const [sectionId,setSectionId]=useState('');
  return <div className="rounded border p-3 space-y-2">
    <p className="text-xs font-semibold">Reuse a form or section from another NOFO</p>
    <div className="flex flex-wrap gap-2"><select aria-label="Copy from NOFO" defaultValue="" onChange={e=>{setSectionId('');state.loadSource(e.target.value);}} className="min-w-40 flex-1 border rounded p-2 text-xs bg-background">
      <option value="" disabled>Select a NOFO</option>{state.sources.map(nofo=><option key={nofo.id} value={nofo.id}>{nofo.title} ({nofo.program_code})</option>)}</select>
      <button type="button" disabled={!state.canCopyForm} className="text-xs border rounded px-2 disabled:opacity-50" onClick={state.copyForm}>Copy entire form</button>
    </div>
    {state.source&&!state.canCopyForm&&<p className="text-xs text-muted-foreground">Whole-form copies use the same grant program. Sections can be copied across programs; program-specific fields become custom fields in this form.</p>}
    {state.source&&<div className="flex gap-2"><select aria-label="Copy source section" value={sectionId} onChange={e=>setSectionId(e.target.value)} className="flex-1 border rounded p-2 text-xs bg-background">
      <option value="">Select section to copy here</option>{state.source.definition.sections.filter(section=>section.kind===state.section.kind).map(section=><option key={section.id} value={section.id}>{section.label}</option>)}</select>
      <button type="button" disabled={!sectionId} className="text-xs border rounded px-2 disabled:opacity-50" onClick={()=>state.copySection(sectionId)}>Copy section</button></div>}
  </div>;
}
