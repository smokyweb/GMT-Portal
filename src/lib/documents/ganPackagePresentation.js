export function ganAttachmentOptions(sources,kind) {
  return sources.filter(source=>source.kind===kind).map(source=>({...source,label:source.title+' · v'+source.version+' · '+source.pages+' page'+(source.pages===1?'':'s')}));
}
export function ganSignaturePages(value) {
  if(!value.trim())return [];
  const values=value.split(',').map(item=>Number(item.trim()));
  if(values.some(page=>!Number.isInteger(page)||page<1)||new Set(values).size!==values.length)throw new Error('Enter distinct page numbers separated by commas, such as 2, 4.');
  return values;
}
export function ganRequiredReturnLabel(part) {
  return (part.kind==='gan'?'Signed GAN':'Special Conditions signature page'+(part.package_signature_pages.length===1?'':'s'))+' · package page'+(part.package_signature_pages.length===1?' ':'s ')+part.package_signature_pages.join(', ');
}
