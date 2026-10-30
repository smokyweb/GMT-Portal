import {defaultForm} from './defaultForm.js';
// Frozen field structure from the seven-step wizard preceding GMT 2.0.
const legacyLabels={
  requested_amount:'Requested Amount ($)',match_amount:'Match/Cost-Share ($)',
  ij_core_capability:'Primary Core Capability Addressed',thira_spr_alignment:'THIRA/SPR Alignment Narrative',
  npa_minimum_met:'NPA Minimum Allocation Requirement Met',npa_allocation_amount:'NPA Allocation Amount ($)',
  slcgp_project_worksheet:'Project Worksheet Details',slcgp_rural_allocation:'Rural Allocation Amount ($)',
  nsgp_vulnerability_assessment:'Vulnerability Assessment Summary',ehp_notes:'Additional EHP Notes (optional)',
};
const ehpLabels=[
  'Does the project involve ground disturbance, excavation, or any digging?',
  'Does the project involve construction, renovation, or physical alteration of a building or structure?',
  'Is the project located in a floodplain (FEMA SFHA or 500-year floodplain)?',
  'Is the project located on or near a property listed or eligible for the National Register of Historic Places?',
  'Does the project affect coastal zones, wetlands, or other sensitive environmental areas?',
  'Does the project involve the installation of towers, antennas, or communications equipment?',
  'Could the project impact threatened or endangered species or their habitat?',
  'Does the project involve hazardous materials, contaminated sites, or underground storage tanks?',
  'Is the project located in a tribal area or does it affect tribal lands or cultural resources?',
  'Is this project a planning, training, or exercise activity only (no physical work)?',
];
export function legacyForm(nofo={}) {
  const definition=defaultForm(nofo);definition.legacy=true;
  for(const section of definition.sections)section.fields=section.fields.filter(field=>field.source!=='custom').map(field=>({
    ...field,label:field.source==='ehp'?ehpLabels[Number(field.key.slice(1))-1]:legacyLabels[field.key]||field.label,
    required:section.kind==='project'?false:field.required,
  }));
  return definition;
}
