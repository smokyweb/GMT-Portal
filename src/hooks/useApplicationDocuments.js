import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {uploadFileToServerDetails} from '@/api/uploads';
const ACCEPTED_EXTENSIONS='.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
const MAX_FILE_SIZE=25*1024*1024;
export function useApplicationDocuments({nofo,app,user,org,onSaveDraft,onDocumentsChanged,extraRequired=[],readOnly=false}) {
  const [documents,setDocuments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const refresh=async()=>{if(!app?.id)return [];const rows=await base44.entities.Document.filter({application_id:app.id});setDocuments(rows||[]);return rows||[];};
  useEffect(()=>{let active=true;if(app?.id)base44.entities.Document.filter({application_id:app.id}).then(rows=>{if(active)setDocuments(rows||[]);}).catch(err=>{if(active)setError(`Unable to load uploaded documents: ${err.message}`);});return()=>{active=false;};},[app?.id]);
  const raw=nofo?.required_documents||[],required=[...(Array.isArray(raw)?raw:raw.name?[raw]:[]),...extraRequired]
    .filter((doc,index,list)=>list.findIndex(item=>item.name===doc.name)===index);
  const upload=async(file,name,type='Other',template=null)=>{
    if(!file||readOnly)return false;setBusy(true);setError('');setStatus(`Uploading ${file.name}…`);
    try {
      if(file.size>MAX_FILE_SIZE)throw new Error('This file is larger than the 25 MB limit.');
      const extension=`.${file.name.split('.').pop()?.toLowerCase()||''}`;
      if(!ACCEPTED_EXTENSIONS.split(',').includes(extension))throw new Error('File type not supported. Use PDF, Word, Excel, PNG, or JPEG.');
      const current=app?.id?app:await onSaveDraft();
      if(!current?.id)throw new Error('Save the application before uploading documents');
      const uploaded=await uploadFileToServerDetails(file);
      if(!uploaded.url)throw new Error('The server did not return an uploaded file');
      setStatus('Saving document record…');
      const created=await base44.entities.Document.create({name:name||file.name,file_name:uploaded.originalName||file.name,file_size:file.size,doc_type:type==='RequiredTemplate'?'Other':type,file_url:uploaded.url,
        uploaded_by:user?.email,organization_id:org?.id||current.organization_id,application_id:current.id,
        application_number:current.application_number,organization_name:org?.name||current.organization_name,
        uploaded_at:new Date().toISOString(),tags:template?.template_id?[`template_id:${template.template_id}`,`template_use:${template.template_use||'Attachment'}`]:[]});
      setDocuments(rows=>[...rows,created]);if(onDocumentsChanged)await onDocumentsChanged();setStatus('Upload complete.');return true;
    }catch(err){setError(err.message||'Upload failed.');setStatus('');return false;}finally{setBusy(false);}
  };
  const remove=async id=>{if(readOnly)return;setBusy(true);setError('');setStatus('Removing document…');try{await base44.entities.Document.delete(id);setDocuments(rows=>rows.filter(doc=>doc.id!==id));if(onDocumentsChanged)await onDocumentsChanged();setStatus('Document removed.');}catch(err){setError(err.message);setStatus('');}finally{setBusy(false);}};
  return {documents,required,general:documents.filter(doc=>!required.some(item=>item.name===doc.name)),busy,error,status,upload,remove,readOnly,acceptedExtensions:ACCEPTED_EXTENSIONS};
}
