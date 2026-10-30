export function ganPdfIdentity(c,m,start) {
  const {x,w,text,box,band,measure}=c,v=m.values;
  const title=v.grant_year+' Sub-Recipient Agreement';
  const subtitle='Notice of Subaward / Grant Award Notice - for '+v.organization_name;
  const nameHeight=measure(v.passthrough_entity,w-110,11,true)+6;
  const titleHeight=measure(title,w-110,9,true)+5;
  const headHeight=Math.max(48,nameHeight+titleHeight+measure(subtitle,w-110,7)+7);
  box(x,start,102,headHeight);text('Date of Award',x+4,start+9,94,{size:7.5,bold:true,align:'center'});text(v.award_date,x+4,start+23,94,{size:7.3,align:'center'});
  box(x+102,start,w-102,headHeight);text(v.passthrough_entity,x+106,start+3,w-110,{size:11,bold:true,align:'center'});
  text(title,x+106,start+nameHeight,w-110,{size:9,bold:true,align:'center'});
  text(subtitle,x+106,start+nameHeight+titleHeight,w-110,{size:7,align:'center'});
  const y=start+headHeight,left=198,right=w-left;
  band('1. Sub-Recipient Name and Address',x,y,left);band('2. Prepared by',x+left,y,180);band('3. Award Number',x+left+180,y,w-left-180);
  // Prepared-by and award identifiers wrap in their own measured row.
  const metaHeight=Math.max(14,measure(v.prepared_by,172,7.1),measure(v.subaward_number,w-left-188,7.1))+6;
  text(v.prepared_by,x+left+4,y+14,172,{size:7.1});text(v.subaward_number,x+left+184,y+14,w-left-188,{size:7.1,bold:true});
  box(x+left,y+13,180,metaHeight);box(x+left+180,y+13,w-left-180,metaHeight);
  const address=[v.organization_name,v.site_name,v.organization_address,'UEI: '+v.organization_uei+'   EIN: '+v.organization_tax_id,
    'Authorized Official: '+v.authorized_official_name,v.authorized_official_title,v.authorized_official_email+' | '+v.authorized_official_phone,
    'State Grant #: '+v.state_grant_number,'Application #: '+v.application_number].filter(Boolean).join('\n');
  const federal=[['Federal Grant Title',v.federal_grant_title],['Federal Award # (FAIN) / CFDA',v.federal_award_number+' / '+v.cfda_number],
    ['Assistance Listing Title',v.cfda_title],['Federal Award Date',v.federal_award_date],['Federal Granting Agency',v.federal_granting_agency],
    ['Total Federal Award to State',v.total_federal_award],['Pass-Through Entity',v.passthrough_entity],['Federal Award Description',v.federal_award_description]];
  const labelW=143;
  const federalHeight=13+federal.reduce((sum,[label,value])=>sum+Math.max(measure(label,labelW-8,6.9,true),measure(value,right-labelW-8,6.9))+3,0)+5;
  const height=Math.max(measure(address,left-8,7.1)+8,metaHeight+federalHeight);
  box(x,y+13,left,height);text(address,x+4,y+17,left-8,{size:7.1});
  band('4. Federal Grant Information',x+left,y+13+metaHeight,right);
  let row=y+26+metaHeight;
  for(const [label,value] of federal){const h=Math.max(measure(label,labelW-8,6.9,true),measure(value,right-labelW-8,6.9))+3;text(label,x+left+4,row,labelW-8,{size:6.9,bold:true});text(value,x+left+labelW,row,right-labelW-8,{size:6.9});row+=h;}
  box(x+left,y+26+metaHeight,right,height-metaHeight-13);
  return y+13+height;
}
