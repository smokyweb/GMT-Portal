export function ganPdfTerms(c,m,start) {
  const {x,w,text,measure,box}=c,v=m.values;
  let y=start;
  for(const value of ['6. Statutory Authority for Grant: '+v.statutory_authority,'7. Method of Payment: '+v.payment_method]) {
    const h=measure(value,w-8,7.1,true)+6;box(x,y,w,h);text(value,x+4,y+3,w-8,{size:7.1,bold:true});y+=h;
  }
  const paragraphs=[m.certification,m.terms,m.programTerms,m.contact],h=paragraphs.reduce((sum,value)=>sum+measure(value,w-8,6.9)+5,0)+2;
  box(x,y,w,h);let row=y+3;
  for(const value of paragraphs)row+=text(value,x+4,row,w-8,{size:6.9})+5;
  return y+h;
}
