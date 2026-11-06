export default function RequiredApplicationDocuments({state}) {
  return <div className="space-y-3">{state.required.map(doc=>{
    const uploadedDoc=[...state.documents].reverse().find(item=>item.name===doc.name&&item.file_url);
    const uploaded=!!uploadedDoc;
    return <div key={doc.name} className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex justify-between gap-2"><p className="text-sm font-medium">{doc.name}</p><span className={'text-xs '+(uploaded?'text-green-700':'text-muted-foreground')}>{uploaded?'Uploaded':doc.mandatory?'Required':'Optional'}</span></div>
      {doc.template_file_url&&<a href={doc.template_file_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Download template</a>}
      {uploadedDoc&&<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{uploadedDoc.file_name||uploadedDoc.name}</span>{uploadedDoc.uploaded_at&&<span>Uploaded {new Date(uploadedDoc.uploaded_at).toLocaleDateString()}</span>}<a href={uploadedDoc.file_url} target="_blank" rel="noreferrer" className="text-primary underline">View</a><button type="button" disabled={state.busy||state.readOnly} onClick={()=>state.remove(uploadedDoc.id)} className="text-red-700 underline">Remove</button></div>}
      <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-muted/50"><span>{uploaded?'Replace completed file':'Upload Completed'}</span><input type="file" aria-label={'Upload '+doc.name} disabled={state.busy||state.readOnly} accept={state.acceptedExtensions} onChange={event=>{const file=event.target.files?.[0];state.upload(file,doc.name,'Other',doc);event.target.value='';}} className="sr-only"/></label>
    </div>;
  })}</div>;
}
