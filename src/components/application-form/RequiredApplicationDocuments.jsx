export default function RequiredApplicationDocuments({state}) {
  return <div className="space-y-3">{state.required.map(doc=>{
    const uploaded=state.documents.some(item=>item.name===doc.name&&item.file_url);
    return <div key={doc.name} className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex justify-between gap-2"><p className="text-sm font-medium">{doc.name}</p><span className={'text-xs '+(uploaded?'text-green-700':'text-muted-foreground')}>{uploaded?'Uploaded':doc.mandatory?'Required':'Optional'}</span></div>
      <input type="file" aria-label={'Upload '+doc.name} disabled={state.busy||state.readOnly} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={event=>{const file=event.target.files?.[0];state.upload(file,doc.name);event.target.value='';}} className="w-full text-sm"/>
    </div>;
  })}</div>;
}
