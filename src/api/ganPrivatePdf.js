export async function readGanPrivatePdf(apiBase,getToken,path,expectedHash=null) {
  const response=await fetch(apiBase+'/api/gan'+path,{headers:{Authorization:'Bearer '+getToken()}});
  if(!response.ok){const body=await response.json().catch(()=>({error:'Unable to load this private PDF'}));throw new Error(body.error);}
  if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('The private PDF is unavailable');
  const blob=await response.blob(),expected=response.headers.get('x-gmt-document-sha256');
  if(!expected||!/^[a-f0-9]{64}$/.test(expected)||expectedHash&&expectedHash!==expected)throw new Error('The PDF does not match the selected record. Reload before continuing.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('The award PDF failed its integrity check. Reload it before continuing.');
  return blob;
}
export function downloadGanPdf(blob,filename) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
