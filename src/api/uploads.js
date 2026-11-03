export async function uploadFileToServer(file) {
  if (!file) throw new Error('Choose a file to upload');
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('gmt_token');
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Upload failed. Please try again.');
  return data.url || '';
}

export function createUploadClient(apiBase,getToken) {
  return {
    async UploadFile({file}) {
      if(!file) throw new Error('Choose a file to upload');
      const form=new FormData();
      form.append('file',file);
      const token=getToken();
      const response=await fetch(`${apiBase}/api/upload`,{
        method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:form,
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||'Upload failed. Please try again.');
      return {file_url:data.url,file_name:data.originalName||data.filename};
    },
  };
}
