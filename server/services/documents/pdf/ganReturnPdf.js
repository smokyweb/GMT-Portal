import {PDFDocument} from 'pdf-lib';
import {accountError} from '../../accountPolicy.js';
import {loadGanAttachmentPdf} from './ganAttachmentPdf.js';
import {ganPackageHash} from '../ganPackagePolicy.js';
// Original signed files remain immutable. This assembled viewing copy does not validate or preserve a PDF certificate.
export async function inspectGanReturnPdf(bytes) {
  const doc=await loadGanAttachmentPdf(bytes,{allowSignatures:true});return {pages:doc.getPageCount(),bytes:bytes.length};
}
export async function renderGanReturnPdf(uploads) {
  const output=await PDFDocument.create(),parts=[];
  for(const upload of uploads){
    const source=await loadGanAttachmentPdf(upload.pdf,{allowSignatures:true});
    try{if(source.getForm().getFields().length)source.getForm().flatten();}catch{throw accountError(422,'Export a flattened copy with visible signatures for review. The original file has not been accepted.');}
    const start=output.getPageCount()+1;
    for(const page of await output.copyPages(source,source.getPageIndices()))output.addPage(page);
    parts.push({kind:upload.kind,upload_id:upload.id,pdf_sha256:upload.pdf_sha256,source_pages:upload.source_pages,page_start:start,page_end:output.getPageCount()});
  }
  if(output.getPageCount()>200)throw accountError(422,'The submitted review copy exceeds 200 pages');
  output.setTitle('GMT signed uploads - requires NEMA verification');output.setProducer('GMT Portal private upload review copy');
  const pdf=Buffer.from(await output.save());if(pdf.length>24*1024*1024)throw accountError(422,'The submitted review copy exceeds 24 MB');
  return {pdf,pages:output.getPageCount(),parts,pdf_sha256:ganPackageHash(pdf)};
}
