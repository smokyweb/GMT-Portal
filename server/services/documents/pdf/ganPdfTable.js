export function ganPdfTable(c,{headers,rows,widths,x,y,size=7,header=true}) {
  const {text,measure,box,doc}=c;
  const draw=(cells,bold=false)=>{
    const height=Math.max(12,...cells.map((value,index)=>measure(value,widths[index]-8,size,bold)+6));
    let left=x;
    cells.forEach((value,index)=>{if(bold){doc.setFillColor(235);doc.rect(left,y,widths[index],height,'F');}box(left,y,widths[index],height);text(value,left+4,y+3,widths[index]-8,{size,bold});left+=widths[index];});
    y+=height;
  };
  if(header)draw(headers,true);for(const cells of rows)draw(cells);return y;
}
