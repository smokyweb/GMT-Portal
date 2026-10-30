import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {accountError} from '../../accountPolicy.js';
import {loadGanAttachmentPdf} from './ganAttachmentPdf.js';
export async function renderGanPackagePdf(gan,attachments,{preview=true}={}) {
  const output=await PDFDocument.create(),font=await output.embedFont(StandardFonts.Helvetica),parts=[];
  const sources=[{kind:'gan',title:gan.snapshot.parts.includes('Project Schedule')?'Grant Award Notice and Project Schedule':'Grant Award Notice',pdf:gan.pdf,pages:gan.snapshot.pages,signature_pages:[1],id:null,pdf_sha256:gan.document.pdf_sha256},...attachments];
  for(const source of sources) {
    const doc=await loadGanAttachmentPdf(source.pdf);
    if(doc.getPageCount()!==source.pages)throw accountError(500,'The saved attachment page count failed its integrity check');
    try{const form=doc.getForm();if(form.getFields().length)form.flatten();}catch{throw accountError(422,'The attachment form cannot be printed reliably. Upload a flattened PDF export.');}
    const start=output.getPageCount()+1,copied=await output.copyPages(doc,doc.getPageIndices());
    for(const page of copied){output.addPage(page);if(preview&&source.kind!=='gan')page.drawText('DRAFT PACKAGE PREVIEW',{x:14,y:10,size:8,font,color:rgb(.55,.1,.1)});}
    parts.push({kind:source.kind,title:source.title,source_id:source.id,source_version:source.version||null,pdf_sha256:source.pdf_sha256,
      page_start:start,page_end:output.getPageCount(),signature_pages:source.signature_pages.map(page=>start+page-1)});
  }
  const pages=output.getPageCount();if(pages>200)throw accountError(422,'The package exceeds 200 pages');
  output.setTitle(preview?'GMT GAN draft package':'GMT GAN signature package');output.setProducer(preview?'GMT Portal draft package':'GMT Portal award package');
  const pdf=Buffer.from(await output.save());
  if(pdf.length>24*1024*1024)throw accountError(422,'The assembled package exceeds 24 MB');
  return {pdf,pages,parts};
}

export async function renderGanPackagePreview(gan,attachments) {return renderGanPackagePdf(gan,attachments);}
