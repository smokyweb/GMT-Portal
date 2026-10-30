import {createHash} from 'node:crypto';
import {accountError} from '../accountPolicy.js';
import {ganPdfModel} from './pdf/ganPdfModel.js';
import {ganPdfCanvas} from './pdf/ganPdfCanvas.js';
import {ganPdfIdentity} from './pdf/ganPdfIdentity.js';
import {ganPdfAward} from './pdf/ganPdfAward.js';
import {ganPdfTerms} from './pdf/ganPdfTerms.js';
import {ganPdfAcceptance} from './pdf/ganPdfAcceptance.js';
import {ganPdfSchedule} from './pdf/ganPdfSchedule.js';
// Internal preview renderer only. It neither persists nor sends a document.
export function renderGanPdfOutput(preview,options,{mode='draft',signatures={}}={}) {
  const model={...ganPdfModel(preview,options),signatures},c=ganPdfCanvas(model,mode);
  let y=ganPdfIdentity(c,model,25);y=ganPdfAward(c,model,y);y=ganPdfTerms(c,model,y);y=ganPdfAcceptance(c,model,y);
  if(y>739)throw Object.assign(accountError(422,'The GAN does not fit one readable page; shorten the source fields or review the template layout'),{code:'gan_pdf_overflow',section:'Grant Award Notice'});
  if(model.requiresProjectSchedule)ganPdfSchedule(c,model);
  const pages=c.doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){c.doc.setPage(page);c.footer(page,pages);}
  const pdf=Buffer.from(c.doc.output('arraybuffer'));
  return {pdf,pdf_sha256:createHash('sha256').update(pdf).digest('hex'),merged_body:preview.body,merged_body_sha256:model.bodyHash,
    template_body_sha256:model.templateHash,template_version:model.templateVersion,pages,previewOnly:mode==='draft',readyForSending:false,
    requiredAttachments:['Special Conditions'],parts:['Grant Award Notice',...(model.requiresProjectSchedule?['Project Schedule']:[])],
    layout:{ganBottom:y,minimumBodyFontSize:6.5}};
}
