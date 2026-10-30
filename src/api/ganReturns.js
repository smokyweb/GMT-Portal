import {readGanPrivatePdf,downloadGanPdf} from './ganPrivatePdf';
export function createGanReturnsClient(apiBase,getToken) {
  return {
    async upload(documentId,input,file){
      const body=new FormData();for(const [key,value] of Object.entries(input))body.append(key,Array.isArray(value)?JSON.stringify(value):String(value));body.append('file',file);
      const response=await fetch(apiBase+'/api/gan/documents/'+encodeURIComponent(documentId)+'/return-uploads',{method:'POST',headers:{Authorization:'Bearer '+getToken()},body});
      const result=await response.json().catch(()=>({error:'Unable to upload the signed PDF'}));if(!response.ok)throw new Error(result.error);return result;
    },
    pdf:submission=>readGanPrivatePdf(apiBase,getToken,'/return-submissions/'+encodeURIComponent(submission.id)+'/pdf',submission.pdf_sha256),
    async downloadSubmission(submission){downloadGanPdf(await readGanPrivatePdf(apiBase,getToken,'/return-submissions/'+encodeURIComponent(submission.id)+'/pdf?download=1',submission.pdf_sha256),'signed-submission-'+submission.submission_number+'.pdf');},
    async downloadOriginal(upload){downloadGanPdf(await readGanPrivatePdf(apiBase,getToken,'/return-uploads/'+encodeURIComponent(upload.id)+'/pdf?download=1',upload.pdf_sha256),'signed-'+upload.kind+'-v'+upload.version+'.pdf');},
  };
}
