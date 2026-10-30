export function ganPdfAcceptance(c,m,start) {
  const {x,w,text,measure,box,band,doc}=c,v=m.values,half=w/2;
  let y=band('9. Agency Approval',x,start,w),height=Math.max(44,measure('Approving NEMA Official:\n'+v.approving_official_name+'\n'+v.approving_official_title,half-8,7.1)+8);
  box(x,y,half,height);box(x+half,y,half,height);
  text('Approving NEMA Official:\n'+v.approving_official_name+'\n'+v.approving_official_title,x+4,y+4,half-8,{size:7.1,bold:true});
  text('Signature of NEMA Official:',x+half+4,y+3,half-8,{size:7.1});doc.line(x+half+4,y+height-18,x+w-5,y+height-18);text('Date:',x+half+4,y+height-15,half-8,{size:7});
  y=band('10. Sub-Recipient Acceptance',x,y+height,w);
  const statement='I have read and understand the attached Terms and Conditions and Special Conditions.';
  const h=measure(statement,w-8,7.1,true)+6;box(x,y,w,h);text(statement,x+4,y+3,w-8,{size:7.1,bold:true});y+=h;
  const signed=m.signatures?.recipient,printed=signed?signed.name+'\n'+signed.title:'',signature=signed?'Electronically signed: '+signed.name:'';
  const acceptanceHeight=Math.max(30,signed?Math.max(measure(printed,half-8,7),measure(signature,half-8,7))+18:0);
  box(x,y,half,acceptanceHeight);box(x+half,y,half,acceptanceHeight);
  text('Print name and title of Authorized Sub-Recipient official:',x+4,y+3,half-8,{size:7});text('Signature of Authorized Sub-Recipient Official:',x+half+4,y+3,half-8,{size:7});
  if(signed){text(printed,x+4,y+14,half-8,{size:7,bold:true});text(signature,x+half+4,y+14,half-8,{size:7,bold:true});}
  y+=acceptanceHeight;const label='11. Sub-Recipient Employer Identification Number (EIN) / Federal Tax Identification Number / Recipient UEI Number';
  height=measure(label,380,6.7,true)+measure('EIN: '+v.organization_tax_id+'   UEI: '+v.organization_uei,380,7)+9;
  box(x,y,390,height);box(x+390,y,w-390,height);
  const labelH=text(label,x+4,y+3,382,{size:6.7,bold:true});text('EIN: '+v.organization_tax_id+'   UEI: '+v.organization_uei,x+4,y+labelH+5,382,{size:7});
  text('12. Date Signed:',x+394,y+3,w-398,{size:7,bold:true});if(signed)text(signed.displayDate,x+394,y+15,w-398,{size:7});y+=height;
  const due='13. DUE DATE: '+v.gan_due_date+'  '+m.returnInstructions;
  height=measure(due,w-8,7.1,true)+7;box(x,y,w,height);text(due,x+4,y+3,w-8,{size:7.1,bold:true});
  return y+height;
}
