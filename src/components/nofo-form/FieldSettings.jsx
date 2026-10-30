import {FIELD_TYPE_LABELS} from '@/lib/forms/formPresentation';
import {FIELD_TYPES,formFields} from '@/lib/forms/defaultForm';
import TableColumnSettings from './TableColumnSettings';
import {newCustomField} from '@/lib/forms/formEditing';
const inputClass='w-full border rounded p-2 text-sm bg-background mt-1';
export default function FieldSettings({state}) {
  const field=state.field,change=state.setField;
  const changeType=type=>{const defaults=newCustomField(type);change({type,options:defaults.options,columns:defaults.columns});};
  return <fieldset className="border rounded-lg p-3 space-y-3 bg-muted/20"><legend className="text-sm font-semibold px-1">Field Settings</legend>
    <label className="block text-xs">Label<input aria-label="Field label" className={inputClass} value={field.label} onChange={e=>change({label:e.target.value})}/></label>
    <label className="block text-xs">Type<select aria-label="Field type" className={inputClass} disabled={field.source!=='custom'} value={field.type} onChange={e=>changeType(e.target.value)}>{FIELD_TYPES.map(type=><option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}</select></label>
    <label className="block text-xs">Help text<textarea aria-label="Field help text" rows={2} className={inputClass} value={field.help||''} onChange={e=>change({help:e.target.value})}/></label>
    <div className="flex flex-wrap gap-3 text-xs">{[['required','Required'],['reviewerVisible','Show to reviewers'],['exportVisible','Include in exports']].map(([key,label])=><label key={key} className="flex gap-1 items-center"><input type="checkbox" checked={field[key]} onChange={e=>change({[key]:e.target.checked})}/>{label}</label>)}</div>
    {['dropdown','yesno','multiselect'].includes(field.type)&&<label className="block text-xs">Choices, one per line<textarea aria-label="Field choices" className={inputClass} rows={3} value={(field.options||[]).join('\n')} onChange={e=>change({options:e.target.value.split('\n')})}/></label>}
    {['number','currency'].includes(field.type)&&<div className="grid grid-cols-2 gap-2">{['min','max'].map(key=><label key={key} className="text-xs">{key==='min'?'Minimum value':'Maximum value'}<input aria-label={key==='min'?'Minimum field value':'Maximum field value'} type="number" className={inputClass} value={field[key]??''} onChange={e=>change({[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</div>}
    {['text','longtext'].includes(field.type)&&<label className="block text-xs">Character limit<input aria-label="Field character limit" type="number" min="1" max="100000" className={inputClass} value={field.maxLength??''} onChange={e=>change({maxLength:e.target.value===''?undefined:Number(e.target.value)})}/></label>}
    {field.type==='table'&&<TableColumnSettings field={field} onChange={change}/>}
    <label className="block text-xs">Show only if<select aria-label="Conditional parent field" className={inputClass} value={field.condition?.fieldId||''} onChange={e=>change({condition:e.target.value?{fieldId:e.target.value,operator:'equals',value:''}:undefined})}>
      <option value="">Always show</option>{formFields(state.definition).filter(item=>item.id!==field.id).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {field.condition&&<div className="grid grid-cols-2 gap-2"><select aria-label="Condition comparison" className={inputClass} value={field.condition.operator} onChange={e=>change({condition:{...field.condition,operator:e.target.value}})}>
      <option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="includes">Includes choice</option></select>
      <input aria-label="Condition value" className={inputClass} value={String(field.condition.value)} onChange={e=>change({condition:{...field.condition,value:e.target.value}})}/></div>}
    {state.section.kind==='ehp'&&<label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={Boolean(field.ehpTrigger)} onChange={e=>change({ehpTrigger:e.target.checked})}/>Yes or Unsure requires EHP review</label>}
  </fieldset>;
}
