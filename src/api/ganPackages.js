export function createGanPackageClient(api,apiBase,getToken) {
  const base='/api/gan',headers=()=>({Authorization:'Bearer '+getToken()});
  const pdf=async path=>{
    const response=await fetch(apiBase+base+path,{headers:headers()});
    if(!response.ok){const error=await response.json().catch(()=>({error:'Unable to load the package PDF'}));throw new Error(error.error);}
    if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('The package PDF is unavailable');
    return response.blob();
  };
  return {
    attachments:nofoId=>api('GET',base+'/nofos/'+encodeURIComponent(nofoId)+'/attachments'),
    document:id=>api('GET',base+'/documents/'+encodeURIComponent(id)),
    history:id=>api('GET',base+'/documents/'+encodeURIComponent(id)+'/packages'),
    package:id=>api('GET',base+'/packages/'+encodeURIComponent(id)),
    prepare:(id,input)=>api('POST',base+'/documents/'+encodeURIComponent(id)+'/packages',input),
    pdf:id=>pdf('/packages/'+encodeURIComponent(id)+'/pdf'),
    async upload(nofoId,input,file) {
      const form=new FormData();for(const [key,value] of Object.entries(input))form.append(key,Array.isArray(value)?JSON.stringify(value):String(value));form.append('file',file);
      const response=await fetch(apiBase+base+'/nofos/'+encodeURIComponent(nofoId)+'/attachments',{method:'POST',headers:headers(),body:form});
      const body=await response.json().catch(()=>({error:'Unable to upload this attachment'}));if(!response.ok)throw new Error(body.error);return body;
    },
    async download(id) {
      const url=URL.createObjectURL(await pdf('/packages/'+encodeURIComponent(id)+'/pdf')),link=document.createElement('a');
      link.href=url;link.download='gan-package-'+id+'-draft.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    },
  };
}
