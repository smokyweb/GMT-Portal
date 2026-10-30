export function createGanBatchClient(api,apiBase,getToken) {
  return {
    options:nofoId=>api('GET','/api/gan/batch-options'+(nofoId?'?nofoId='+encodeURIComponent(nofoId):'')),
    check:input=>api('POST','/api/gan/batch-preview',input),
    create:input=>api('POST','/api/gan/batches',input),
    batch:id=>api('GET','/api/gan/batches/'+encodeURIComponent(id)),
    run:(id,input={})=>api('POST','/api/gan/batches/'+encodeURIComponent(id)+'/run',input),
    async download(id,revision) {
      const response=await fetch(apiBase+'/api/gan/documents/'+encodeURIComponent(id)+'/pdf?revision='+revision,{headers:{Authorization:'Bearer '+getToken()}});
      if(!response.ok){const data=await response.json().catch(()=>({error:'Unable to load the saved draft PDF'}));throw new Error(data.error);}
      if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('The saved draft PDF is unavailable');
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
      link.href=url;link.download='gan-'+id+'-r'+revision+'-draft.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    },
  };
}
