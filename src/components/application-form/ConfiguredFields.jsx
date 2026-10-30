import {fieldValue,fieldIsVisible} from '@/lib/forms/defaultForm';
import SimpleFieldInput from './SimpleFieldInput';
import ComplexFieldInput from './ComplexFieldInput';
export default function ConfiguredFields({section,state}) {
  return <div className="space-y-4">{section.fields.filter(field=>fieldIsVisible({...field,sectionEnabled:section.enabled},state.definition,state.context)).map(field=><div key={field.id} className="space-y-1">
    <label htmlFor={field.id} className="text-sm font-medium">{field.label}{field.required&&<span className="text-red-600 ml-1">*</span>}</label>
    {field.help&&<p className="text-xs text-muted-foreground">{field.help}</p>}
    {['file','table','multiselect','daterange'].includes(field.type)?<ComplexFieldInput field={field} value={fieldValue(field,state.context)} disabled={state.busy||state.submitted} onChange={value=>state.setField(field,value)} onUpload={file=>state.upload(field,file)}/>:
      <SimpleFieldInput field={field} value={fieldValue(field,state.context)} disabled={state.busy||state.submitted} readOnly={field.source==='organization'} onChange={value=>state.setField(field,value)}/>}
  </div>)}</div>;
}
