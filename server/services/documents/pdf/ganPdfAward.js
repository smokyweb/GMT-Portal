import {ganPdfTable} from './ganPdfTable.js';
export function ganPdfAward(c,m,start) {
  const {x,w,text,box,band}=c,v=m.values,left=128,right=w-left;
  const y=band('5. Award Amount and Grant Breakdowns',x,start,w);
  const amounts=[['Total Award Amount',v.total_award_amount],['Federal funds obligated by this action',v.amount_this_action],['Match / cost share',v.match_amount]];
  let a=y+10;
  for(const [label,value] of amounts){a+=text(label,x+6,a,left-12,{size:7.3,bold:true,align:'center'})+3;a+=text(value,x+6,a,left-12,{size:9,bold:true,align:'center'})+9;}
  a+=text(v.cost_share_requirement,x+6,a,left-12,{size:6.8,align:'center'})+5;
  let r=y+4;
  r+=text(v.full_grant_name,x+left+4,r,right-8,{size:7.5,bold:true,align:'center'})+3;
  r+=text('Performance and Budget Period: '+v.performance_start_date+' - '+v.performance_end_date,x+left+4,r,right-8,{size:7,align:'center'})+4;
  r+=text('Project: '+v.project_title+'\nScope: '+v.scope_of_work_summary,x+left+4,r,right-8,{size:6.9})+5;
  if(m.requiresProjectSchedule)r+=text('See attached Project Schedule ('+m.projects.length+' projects).\nFederal total: '+v.total_award_amount+' | Match total: '+v.match_amount,x+left+4,r,right-8,{size:7,bold:true})+5;
  else r=ganPdfTable(c,{headers:['Project ID','Project','Main POETE','Federal','Match'],rows:m.projects.map(p=>[p.project_id,p.name,p.poete,p.federal,p.match]),
    widths:[112,106,80,65,65],x:x+left,y:r,size:6.5})+6;
  const names=['Planning','Organization','Equipment','Training','Exercises','M&A','Total'];
  const keys=['budget_planning','budget_organization','budget_equipment','budget_training','budget_exercises','budget_ma','budget_total'];
  r=ganPdfTable(c,{headers:names,rows:[keys.map(key=>v[key])],widths:Array(7).fill(right/7),x:x+left,y:r,size:6.5})+5;
  r+=text('Indirect Cost Rate: '+v.indirect_cost_rate+'   Research & Development (R&D): '+v.is_r_and_d,x+left+4,r,right-8,{size:6.9,bold:true})+3;
  if(v.indirect_rd_statement)r+=text(v.indirect_rd_statement,x+left+4,r,right-8,{size:6.9})+3;
  const end=Math.max(a,r)+4;box(x,y,left,end-y);box(x+left,y,right,end-y);
  return end;
}
