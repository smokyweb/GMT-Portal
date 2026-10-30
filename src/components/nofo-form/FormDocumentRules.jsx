export default function FormDocumentRules({state}) {
  const documents=state.definition.rules.requiredDocuments||[];
  const change=next=>state.change({...state.definition,rules:{...state.definition.rules,requiredDocuments:next}});
  return <fieldset className="border rounded-lg p-3 space-y-2"><legend className="text-xs font-semibold">Document requirements for this form version</legend>
    {documents.map((doc,index)=><div key={index} className="flex gap-2 items-center">
      <input aria-label={'Required document '+(index+1)+' name'} value={doc.name} onChange={event=>change(documents.map((item,i)=>i===index?{...item,name:event.target.value}:item))} className="flex-1 min-w-0 border rounded bg-background p-2 text-xs"/>
      <label className="flex gap-1 text-xs"><input type="checkbox" checked={doc.mandatory} onChange={event=>change(documents.map((item,i)=>i===index?{...item,mandatory:event.target.checked}:item))}/>Required</label>
      <button type="button" aria-label={'Remove required document '+(index+1)} className="text-xs text-red-700" onClick={()=>change(documents.filter((_,i)=>i!==index))}>Remove</button>
    </div>)}
    <button type="button" className="text-xs text-primary" onClick={()=>change([...documents,{name:'',mandatory:true}])}>+ Add document requirement</button>
  </fieldset>;
}
