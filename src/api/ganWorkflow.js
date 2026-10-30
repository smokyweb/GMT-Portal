import {readGanPrivatePdf} from './ganPrivatePdf';
export function createGanWorkflowClient(api,apiBase,getToken) {
  const base='/api/gan';
  const pdf=(id,download=false)=>readGanPrivatePdf(apiBase,getToken,'/issues/'+encodeURIComponent(id)+'/pdf'+(download?'?download=1':''));
  return {
    list:()=>api('GET',base+'/workflow-documents'),
    read:id=>api('GET',base+'/documents/'+encodeURIComponent(id)+'/workflow'),
    readiness:(id,packageId)=>api('GET',base+'/documents/'+encodeURIComponent(id)+'/send-readiness?packageId='+encodeURIComponent(packageId)),
    act:(id,action,input)=>api('POST',base+'/documents/'+encodeURIComponent(id)+'/actions/'+encodeURIComponent(action),input),
    pdf,
    async download(id){const url=URL.createObjectURL(await pdf(id,true)),link=document.createElement('a');link.href=url;link.download='gan-'+id+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},
  };
}
