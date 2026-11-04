const API_BASE=import.meta.env.VITE_API_URL||'';
export async function listAwardNotices(applicationId) {
  const token=localStorage.getItem('gmt_token');
  const response=await fetch(`${API_BASE}/api/award-notices/applications/${applicationId}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Unable to load GAN history');
  return data;
}
