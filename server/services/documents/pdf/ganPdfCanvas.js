import fs from 'node:fs';
import {jsPDF} from 'jspdf';
import {accountError} from '../../accountPolicy.js';
const fonts=new Map();
export function ganPdfCanvas(model,mode='draft') {
  const labels={draft:'DRAFT PREVIEW - NOT SENT OR EXECUTED',issued:'ISSUED FOR SIGNATURE - NOT FULLY EXECUTED',recipient_signed:'SUBRECIPIENT SIGNED - AWAITING NEMA COUNTERSIGNATURE'};
  if(!Object.hasOwn(labels,mode))throw accountError(400,'Choose a supported GAN rendering stage');
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true,putOnlyUsedFonts:true});
  for(const [style,file] of [['normal','DejaVuSans.ttf'],['bold','DejaVuSans-Bold.ttf']]) {
    if(!fonts.has(file))fonts.set(file,fs.readFileSync(new URL('../../../assets/fonts/'+file,import.meta.url)).toString('base64'));
    doc.addFileToVFS(file,fonts.get(file));doc.addFont(file,'GMT',style);
  }
  doc.setFileId(model.bodyHash.slice(0,32).toUpperCase());
  doc.setCreationDate(new Date(model.values.award_date+' 12:00:00 GMT'));
  doc.setProperties({title:(mode==='draft'?'DRAFT GAN - ':'GAN - ')+model.values.subaward_number,subject:(mode==='draft'?'Preview only - not sent or executed':labels[mode])+'; template version '+model.templateVersion,author:'GMT Portal'});
  const box=(x,y,w,h)=>{doc.setDrawColor(70);doc.setLineWidth(.45);doc.rect(x,y,w,h);};
  const lines=(value,width,size=7.3,bold=false)=>{
    const text=String(value??'').normalize('NFC');
    doc.setFont('GMT',bold?'bold':'normal');doc.setFontSize(size);
    const glyphs=doc.getFont().metadata.cmap.unicode.codeMap;
    for(const char of text)if(!['\n','\r','\t'].includes(char)&&(!glyphs[char.codePointAt(0)]||char.codePointAt(0)<32))throw accountError(422,'The PDF font cannot represent a character in this award; review the source text');
    return text.split('\n').flatMap(line=>doc.splitTextToSize(line,width));
  };
  const measure=(text,w,size=7.3,bold=false)=>lines(text,w,size,bold).length*size*1.22;
  const text=(value,x,y,w,{size=7.3,bold=false,align='left'}={})=>{
    const rows=lines(value,w,size,bold);doc.setTextColor(20);doc.text(rows,align==='center'?x+w/2:align==='right'?x+w:x,y+size,{lineHeightFactor:1.22,align});return rows.length*size*1.22;
  };
  const band=(label,x,y,w,{size=7.3}={})=>{doc.setFillColor(222);doc.rect(x,y,w,13,'F');box(x,y,w,13);text(label,x+4,y+1,w-8,{size,bold:true});return y+13;};
  const footer=(page,count)=>{if(measure(model.values.subaward_number+' | '+page+' of '+count,254,6.5)>24)throw accountError(422,'Shorten the subaward number before rendering the PDF footer');text(labels[mode],28,756,300,{size:6.5,bold:true});text(model.values.subaward_number+' | '+page+' of '+count,330,756,254,{size:6.5,align:'right'});};
  return {doc,box,lines,measure,text,band,footer,x:28,w:556};
}
