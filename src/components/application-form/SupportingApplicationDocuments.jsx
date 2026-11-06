import {documentTypeLabel} from '@/lib/forms/formPresentation';
import {useState} from 'react';
export default function SupportingApplicationDocuments({state}) {
  const [name,setName]=useState(''),[type,setType]=useState('Other'),[file,setFile]=useState(null),[inputKey,setInputKey]=useState(0);
  const upload=async()=>{if(await state.upload(file,name||file?.name,type)){setFile(null);setName('');setInputKey(key=>key+1);}};
  return <div className="space-y-3"><h3 className="text-sm font-semibold">Supporting Documents</h3>
    {state.general.length===0&&<p className="text-sm text-muted-foreground">No supporting documents uploaded yet.</p>}
    {state.general.map(doc=><div key={doc.id} className="flex flex-wrap items-center gap-2 rounded border p-3"><p className="flex-1 text-sm">{doc.file_name||doc.name}</p>{doc.uploaded_at&&<span className="text-xs text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</span>}<a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary">View</a><button type="button" disabled={state.busy||state.readOnly} aria-label={'Remove document '+doc.name} onClick={()=>state.remove(doc.id)} className="text-xs text-red-700">Remove</button></div>)}
    <div className="border border-dashed rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3"><label className="text-xs">Document name<input aria-label="Supporting document name" className="block w-full mt-1 border rounded p-2 bg-background text-sm" value={name} onChange={event=>setName(event.target.value)}/></label>
        <label className="text-xs">Document type<select aria-label="Supporting document type" className="block w-full mt-1 border rounded p-2 bg-background text-sm" value={type} onChange={event=>setType(event.target.value)}>{['BudgetJustification','Contract','Invoice','MatchDocumentation','PerformanceEvidence','Other'].map(value=><option key={value} value={value}>{documentTypeLabel(value)}</option>)}</select></label></div>
      <input key={inputKey} aria-label="Supporting document file" type="file" disabled={state.busy||state.readOnly} accept={state.acceptedExtensions} onChange={event=>setFile(event.target.files?.[0]||null)} className="w-full text-sm"/>
      {!file&&<p className="text-xs text-muted-foreground">Choose a file to enable Upload Document.</p>}
      <button type="button" disabled={state.busy||state.readOnly||!file} onClick={upload} className="border rounded px-3 py-2 text-sm disabled:opacity-40">{state.busy?'Uploading…':'Upload Document'}</button>
    </div>
  </div>;
}
