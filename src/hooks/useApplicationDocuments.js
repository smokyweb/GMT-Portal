import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {uploadFileToServer} from '@/api/uploads';
export function useApplicationDocuments({nofo,app,user,org,onSaveDraft,extraRequired=[],readOnly=false}) {
  const [documents,setDocuments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(app?.id)base44.entities.Document.filter({application_id:app.id}).then(rows=>{if(active)setDocuments(rows);});return()=>{active=false;};},[app?.id]);
  const raw=nofo?.required_documents||[],required=[...(Array.isArray(raw)?raw:raw.name?[raw]:[]),...extraRequired]
    .filter((doc,index,list)=>list.findIndex(item=>item.name===doc.name)===index);
  const upload=async(file,name,type='Other',template=null)=>{
    if(!file||readOnly)return false;setBusy(true);setError('');
    try {
      const current=app?.id?app:await onSaveDraft();
      if(!current?.id)throw new Error('Save the application before uploading documents');
      const fileUrl=await uploadFileToServer(file);
      if(!fileUrl)throw new Error('The server did not return an uploaded file');
      const created=await base44.entities.Document.create({name:name||file.name,doc_type:type,file_url:fileUrl,
        uploaded_by:user?.email,organization_id:org?.id||current.organization_id,application_id:current.id,
        application_number:current.application_number,organization_name:org?.name||current.organization_name,
        uploaded_at:new Date().toISOString(),tags:template?.template_id?[`template_id:${template.template_id}`,`template_use:${template.template_use||'Attachment'}`]:[]});
      setDocuments(rows=>[...rows,created]);return true;
    }catch(err){setError(err.message);return false;}finally{setBusy(false);}
  };
  const remove=async id=>{if(readOnly)return;setBusy(true);setError('');try{await base44.entities.Document.delete(id);setDocuments(rows=>rows.filter(doc=>doc.id!==id));}catch(err){setError(err.message);}finally{setBusy(false);}};
  return {documents,required,general:documents.filter(doc=>!required.some(item=>item.name===doc.name)),busy,error,upload,remove,readOnly};
}
