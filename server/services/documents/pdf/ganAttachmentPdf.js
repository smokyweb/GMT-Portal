import {PDFDocument,PDFDict,PDFName,PDFArray} from 'pdf-lib';
import {accountError} from '../../accountPolicy.js';
export const MAX_GAN_ATTACHMENT_BYTES=10*1024*1024;
function assertStaticPdf(doc,{allowSignatures=false}={}) {
  const visited=new Set(),blocked=['JavaScript','JS','Launch','RichMedia','EmbeddedFiles','EF','XFA','SubmitForm','ImportData'];
  const visit=(object,depth=0)=>{
    if(visited.has(object))return;visited.add(object);
    if(depth>60||visited.size>100000)throw accountError(422,'The PDF structure is too complex; upload a simpler PDF export');
    if(object instanceof PDFDict){
      const action=object.get(PDFName.of('S'));
      if(object.keys().some(key=>blocked.includes(key.decodeText()))||action instanceof PDFName&&['JavaScript','Launch','SubmitForm','ImportData','GoToR'].includes(action.decodeText()))throw accountError(422,'Export a static PDF without scripts, embedded files, external actions or XFA');
      if(!allowSignatures&&object.get(PDFName.of('FT'))?.toString()==='/Sig'&&object.has(PDFName.of('V')))throw accountError(422,'Upload an unsigned blank attachment; existing digital signatures cannot be preserved in a new package');
      for(const [,value] of object.entries())visit(value,depth+1);
    }else if(object instanceof PDFArray)for(const value of object.asArray())visit(value,depth+1);
  };
  for(const [,object] of doc.context.enumerateIndirectObjects())visit(object);
}
export async function loadGanAttachmentPdf(bytes,options={}) {
  if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.length>MAX_GAN_ATTACHMENT_BYTES||!bytes.subarray(0,8).toString('ascii').startsWith('%PDF-'))throw accountError(400,'Choose a PDF no larger than 10 MB');
  let doc;
  try{doc=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});}catch{throw accountError(422,'The PDF is invalid or encrypted. Upload an unlocked PDF export.');}
  try {
  if(doc.isEncrypted||doc.getPageCount()<1||doc.getPageCount()>150)throw accountError(422,'Choose an unlocked PDF with 1–150 pages');
  assertStaticPdf(doc,options);
  for(const page of doc.getPages()){const {width,height}=page.getSize();if(!Number.isFinite(width)||!Number.isFinite(height)||width<72||height<72||width>2000||height>2000)throw accountError(422,'The attachment has an unsupported page size');}
  return doc;
  }catch(error){if(error.status)throw error;throw accountError(422,'The PDF structure is invalid. Upload a new PDF export.');}
}
export async function inspectGanAttachmentPdf(bytes,signaturePages) {
  const doc=await loadGanAttachmentPdf(bytes),pages=doc.getPageCount();
  if(signaturePages.some(page=>page>pages))throw accountError(422,'A signature page is outside the uploaded PDF');
  return {pages,bytes:bytes.length};
}
