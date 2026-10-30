import {ganSnapshotPreview} from './ganSnapshotModel.js';
import {PDFDocument} from 'pdf-lib';
import {accountError} from '../accountPolicy.js';
import {renderGanPdfOutput} from './ganPdfRender.js';
import {renderGanPackagePdf} from './pdf/ganPackagePdf.js';
import {verifyGanAttachment} from './ganAttachments.js';
import {ganPackageHash} from './ganPackagePolicy.js';
import {ganSignatureCertificate} from './pdf/ganSignatureCertificate.js';
export async function renderGanIssuedPackage(db,snapshot,packageManifest,{recipient=null,certificate=null}={}) {
  const rendered=renderGanPdfOutput(ganSnapshotPreview(snapshot),{programCode:snapshot.values.program_code,templateBody:snapshot.template_body,templateVersion:snapshot.template_version},
    {mode:recipient?'recipient_signed':'issued',signatures:{recipient}});
  const sources=[];
  for(const part of packageManifest.parts.filter(p=>p.source_id)){
    const source=(await db.query('SELECT * FROM gan_attachment_sources WHERE id=$1',[part.source_id])).rows[0];verifyGanAttachment(source);
    if(source.pdf_sha256!==part.pdf_sha256||source.nofo_id!==packageManifest.nofo_id)throw accountError(500,'The recorded attachment failed its package integrity check');
    sources.push(source);
  }
  const gan={snapshot:{...snapshot,pages:rendered.pages},document:{pdf_sha256:rendered.pdf_sha256},pdf:rendered.pdf};
  const result=await renderGanPackagePdf(gan,sources,{preview:false});
  if(result.pages!==packageManifest.pages)throw accountError(422,'Review this GAN layout before sending; its saved package page count changed');
  if(certificate){
    const original=await PDFDocument.load(result.pdf),cert=await PDFDocument.load(ganSignatureCertificate(snapshot,certificate)),pages=await original.copyPages(cert,cert.getPageIndices());
    pages.forEach(page=>original.addPage(page));result.pdf=Buffer.from(await original.save());result.pages=original.getPageCount();
    result.parts.push({kind:'signature_certificate',title:'Electronic signature record',page_start:result.pages,page_end:result.pages,signature_pages:[],source_id:null});
  }
  return {...result,pdf_sha256:ganPackageHash(result.pdf)};
}
