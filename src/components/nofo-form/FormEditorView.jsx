import FormDocumentRules from './FormDocumentRules';
import FormSections from './FormSections';
import FormFields from './FormFields';
import FieldSettings from './FieldSettings';
import FormCopyControls from './FormCopyControls';
export default function FormEditorView({state,title='Application Form',description='',saveLabel='Save Application Form'}) {
  if(state.loading)return <p role="status" className="text-sm p-4">Loading application form…</p>;
  if(!state.definition)return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  return <section className="space-y-4">
    <div className="rounded-lg bg-muted/40 border p-3 text-sm">
      <p className="font-semibold">{title} · Version {state.version.version||'not yet saved'}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      {state.version.definition.legacy&&<p className="text-xs text-muted-foreground mt-1">Legacy form structure is preserved. Use current program defaults to prepare a new form version.</p>}
    </div>
    {state.error&&<p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded">{state.error}</p>}
    {state.notice&&<p role="status" className="text-sm text-green-700 bg-green-50 p-3 rounded">{state.notice}</p>}
    {!state.canEdit&&<p className="text-sm text-muted-foreground">This form is read only for your administrator scope.</p>}
    <fieldset disabled={state.busy||!state.canEdit} className="space-y-4">
    {state.canLoadProgramDefaults&&<button type="button" onClick={state.loadProgramDefaults} className="border rounded px-3 py-2 text-sm">Use Current Program Defaults</button>}
    <FormCopyControls state={state}/>
    <div className="grid md:grid-cols-[170px_1fr] gap-4">
      <FormSections state={state}/><div className="space-y-4"><FormFields state={state}/>{state.section.kind==='documents'&&<FormDocumentRules state={state}/>}{state.field&&<FieldSettings state={state}/>}</div>
    </div>
    <fieldset className="border rounded-lg p-3 grid sm:grid-cols-2 gap-3"><legend className="px-1 text-sm font-semibold">Submission rules</legend>
      <label className="text-xs space-y-1">Minimum match (% of total project cost)<input aria-label="Minimum match percentage" type="number" min="0" max="99.99" step="0.01" className="block w-full rounded border p-2 bg-background text-sm" value={state.definition.rules.matchPercent} onChange={e=>state.change({...state.definition,rules:{...state.definition.rules,matchPercent:Number(e.target.value)}})}/></label>
      <label className="text-xs space-y-1">Required EHP document name<input aria-label="Required EHP document name" className="block w-full rounded border p-2 bg-background text-sm" value={state.definition.rules.ehpScreeningDocument} onChange={e=>state.change({...state.definition,rules:{...state.definition.rules,ehpScreeningDocument:e.target.value}})}/></label>
    </fieldset>
    </fieldset>
    <div className="flex items-center justify-between gap-2 border-t pt-3"><p className="text-xs text-muted-foreground">{state.dirty?'Unsaved form changes':'Form is up to date'}</p>
      <button type="button" disabled={state.busy||!state.canEdit||!state.dirty&&Boolean(state.version.id)} onClick={state.save} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50">{state.busy?'Saving…':saveLabel}</button></div>
  </section>;
}
