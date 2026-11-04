export async function generateTemplateDraft({templateId,applicationId}) {
  const token=localStorage.getItem('gmt_token');
  const response=await fetch(`${import.meta.env.VITE_API_URL||''}/api/template-documents/generate`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({templateId,applicationId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Unable to generate draft');
  return data;
}
