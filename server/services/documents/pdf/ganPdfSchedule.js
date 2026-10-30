import {ganPdfTable} from './ganPdfTable.js';
import {accountError} from '../../accountPolicy.js';
export function ganPdfSchedule(c,m) {
  const {x,w,text,box,band,doc}=c,v=m.values;
  doc.addPage();let y=28;
  y+=text(v.passthrough_entity,x,y,w,{size:12,bold:true,align:'center'})+5;
  y+=text('Project Schedule - Attachment to Grant Award Notice',x,y,w,{size:10,bold:true,align:'center'})+10;
  y+=text('Application #: '+v.application_number+'   Subaward #: '+v.subaward_number+'\nRecipient: '+v.organization_name+'\nPerformance Period: '+v.performance_start_date+' - '+v.performance_end_date,x,y,w,{size:8})+12;
  y=ganPdfTable(c,{headers:['Project ID','Project name','Main POETE','Federal share','Match share'],
    rows:m.projects.map(p=>[p.project_id,p.name,p.poete,p.federal,p.match]),widths:[130,160,100,83,83],x,y,size:7.5});
  y=band('Approved project allocations',x,y,w);
  const h=text('Total federal: '+v.total_award_amount+'    Total match: '+v.match_amount+'\nThis schedule is part of the GAN identified above. Project allocations reconcile to the award totals.',x+5,y+5,w-10,{size:8})+10;
  box(x,y,w,h);
  if(y+h>739)throw Object.assign(accountError(422,'Project Schedule does not fit one readable page; shorten project names or review the schedule layout'),{code:'gan_pdf_overflow',section:'Project Schedule'});
}
