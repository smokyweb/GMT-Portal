export const ACCOUNT_CSV_TEMPLATE='email,role,name,organization_name,scope_state,phone\nnew.signer@example.org,user,New Signer,Example Organization,NE,555-0100\n';
export function parseAccountCsv(text) {
  const matrix=[];let row=[],cell='',quoted=false,closed=false;
  const input=String(text).replace(/^\uFEFF/,'');
  const pushCell=()=>{row.push(cell.trim());cell='';closed=false;};
  const pushRow=()=>{pushCell();if(row.some(Boolean))matrix.push(row);row=[];};
  for(let i=0;i<input.length;i++) {
    const char=input[i];
    if(quoted) {
      if(char==='"'&&input[i+1]==='"'){cell+='"';i++;}
      else if(char==='"'){quoted=false;closed=true;}
      else cell+=char;
    }else if(char==='"') {
      if(cell.trim()||closed)throw new Error('Unexpected quote in CSV field');quoted=true;
    }else if(char===',')pushCell();
    else if(char==='\n'||char==='\r'){if(char==='\r'&&input[i+1]==='\n')i++;pushRow();}
    else {if(closed&&!/\s/.test(char))throw new Error('Unexpected text after a quoted CSV field');cell+=char;}
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted field');
  if(cell||row.length)pushRow();
  if(matrix.length<2)throw new Error('CSV must have a header row and at least one data row');
  const headers=matrix.shift().map(header=>header.toLowerCase());
  if(!headers.includes('email'))throw new Error('CSV must include an email column');
  if(new Set(headers).size!==headers.length)throw new Error('CSV contains duplicate column headers');
  if(headers.some(header=>['password','password_hash'].includes(header)))throw new Error('Do not upload passwords or password hashes');
  if(matrix.length>200)throw new Error('Upload no more than 200 users at a time');
  return matrix.map((cells,index)=>{
    if(cells.length!==headers.length)throw new Error(`Row ${index+2} has ${cells.length} values; expected ${headers.length}`);
    return Object.fromEntries(headers.map((key,i)=>[key,cells[i]]));
  });
}
export function downloadAccountCsv(content,filename) {
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}
export function importErrorCsv(rows) {
  const escape=value=>{
    let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return [['row','email','errors'],...rows.filter(row=>row.errors?.length||row.error)
    .map(row=>[row.row,row.email,row.error||row.errors.join('; ')])].map(row=>row.map(escape).join(',')).join('\r\n');
}
