export function readableValue(value,field=undefined) {
  if(value===undefined||value===null||value==='')return '—';
  if(typeof value==='boolean')return value?'Yes':'No';
  if(field?.type==='date')return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
  if(field?.type==='currency'&&Number.isFinite(Number(value)))return Number(value).toLocaleString('en-US',{style:'currency',currency:'USD'});
  if(field?.type==='yesno')return ({yes:'Yes',no:'No',unknown:'Unsure',unsure:'Unsure'})[String(value).toLowerCase()]||String(value);
  if(Array.isArray(value))return value.map(item=>typeof item==='object'?Object.entries(item).map(([key,data])=>{
    const column=field?.columns?.find(entry=>entry.id===key);return (column?.label||key)+': '+readableValue(data,column);
  }).join('; '):readableValue(item)).join('\n');
  if(typeof value==='object')return value.file_name||value.name||value.url||[value.start,value.end].filter(Boolean).join(' to ');
  return field?.optionLabels?.[value]||String(value);
}

export const FIELD_TYPE_LABELS={text:'Text',longtext:'Long Text',number:'Number',currency:'Currency',date:'Date',daterange:'Date Range',dropdown:'Dropdown',multiselect:'Multi-select',checkbox:'Checkbox',yesno:'Yes / No',file:'File Upload',table:'Repeating Table'};
export const documentTypeLabel=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2');
