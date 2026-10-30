const field=(key,label,type='text',required=false,extra={})=>({id:'std_'+key,key,label,type,required,source:'application',visible:true,reviewerVisible:true,exportVisible:true,...extra});
export const PROJECT_FIELDS=[
  field('project_title','Project Title','text',true,{maxLength:250}),
  field('project_narrative','Project Narrative','longtext',true),
  field('work_plan','Work Plan','longtext'),
  field('risk_assessment','Risk Assessment','longtext'),
  field('requested_amount','Federal Share ($)','currency',true,{min:0}),
  field('match_amount','Match / Cost Share ($)','currency',true,{min:0}),
  field('performance_start','Performance Start','date',true),
  field('performance_end','Performance End','date',true),
];
const programFields={
  SHSP:[['ij_title','IJ Title','text'],['ij_description','IJ Narrative','longtext'],['ij_core_capability','Primary Core Capability','text'],['ij_funding_priority','Funding Priority Alignment','longtext',false],['thira_spr_alignment','THIRA / SPR Alignment','longtext'],['npa_minimum_met','NPA Minimum Requirement Met','checkbox',false],['npa_allocation_amount','NPA Allocation ($)','currency',false]],
  EMPG:[['empg_work_plan_objectives','Key Work Plan Objectives','longtext'],['empg_match_source','Match Source','text'],['empg_match_description','Match Description','longtext']],
  SLCGP:[['slcgp_cybersecurity_plan','Cybersecurity Plan Narrative','longtext'],['slcgp_project_worksheet','Project Worksheet','longtext'],['slcgp_rural_allocation','Rural Allocation ($)','currency',false],['slcgp_rural_allocation_notes','Rural Allocation Approach','longtext',false]],
  NSGP:[['ij_title','IJ Title','text'],['ij_description','IJ Narrative Summary','longtext'],['nsgp_vulnerability_assessment','Vulnerability Assessment','longtext'],['nsgp_mission_statement','Mission Statement','longtext'],['nsgp_target_hardening_description','Target Hardening Description','longtext',false]],
  EOC:[['eoc_construction_timeline','Construction Timeline','longtext'],['eoc_procurement_plan','Procurement Plan','longtext'],['eoc_site_control_status','Site Control Status','dropdown'],['eoc_site_control_notes','Site Control Notes','longtext',false]],
};
export function standardProgramFields(code) {
  const fields=(programFields[code]||[]).map(([key,label,type,required=true])=>field(key,label,type,required,key==='eoc_site_control_status'?{options:['Owned','Leased','In-Progress','Not-Established']}:{}));
  return [...fields,
    field('procurement_method','Primary Procurement Method','dropdown',false,{options:['CompetitiveBid','SoleSource','SmallPurchase','MicroPurchase','NotApplicable'],optionLabels:{CompetitiveBid:'Competitive Bid / Sealed Bid',SoleSource:'Sole Source',SmallPurchase:'Small Purchase',MicroPurchase:'Micro-Purchase',NotApplicable:'Not Applicable'}}),
    field('procurement_justification','Sole Source Justification','longtext',true,{condition:{fieldId:'std_procurement_method',operator:'equals',value:'SoleSource'}}),
    field('procurement_amount','Estimated Procurement Amount ($)','currency',false,{min:0}),
  ];
}
export const EHP_LABELS=[
  'Does the project involve ground disturbance, excavation, or digging?',
  'Does the project involve construction, renovation, or physical alteration of a structure?',
  'Is the project located in a floodplain?',
  'Is the project on or near a listed or eligible historic property?',
  'Does the project affect coastal zones, wetlands, or sensitive environmental areas?',
  'Does the project involve towers, antennas, or communications equipment installation?',
  'Could the project affect threatened or endangered species or habitat?',
  'Does the project involve hazardous materials or contaminated sites?',
  'Does the project affect tribal lands or cultural resources?',
  'Is this a planning, training, or exercise activity only, with no physical work?',
];
export const EHP_FIELDS=EHP_LABELS.map((label,index)=>({
  id:'ehp_q'+(index+1),key:'q'+(index+1),label,type:'yesno',source:'ehp',required:true,visible:true,
  options:['yes','no','unknown'],ehpTrigger:index<9,reviewerVisible:true,exportVisible:true,
}));

export const ORGANIZATION_FIELDS=[
  ['name','Organization Name',true],['type','Organization Type',true],['ein','EIN',false],['sam_uei','SAM UEI',false],
  ['address','Address',false],['city','City',false],['state','State',true],['zip','ZIP Code',false],['county','County',false],
].map(([key,label,required])=>({id:'org_'+key,key,label,type:'text',required,source:'organization',visible:true,reviewerVisible:true,exportVisible:true}));
