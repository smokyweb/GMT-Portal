import {canonicalProgramCode} from '../programCompatibility.js';
export const PROJECT_FIELD_KEYS=['investment','ij_core_capability','ij_funding_priority','national_priority_area','letpa_eligible','shareable','deployable'];
export const PROJECT_FIELD_LABELS={investment:'Investment',ij_core_capability:'IJ Core Capability',ij_funding_priority:'IJ Funding Priority',national_priority_area:'National Priority Area',letpa_eligible:'LETPA',shareable:'Shareable',deployable:'Deployable'};
export const FEMA_CORE_CAPABILITIES=['Community Resilience','Intelligence and Information Sharing','Interdiction and Disruption','Mass Casualty Response','Mass Care Services','Operational Coordination','Public Information and Warning','Screening, Search, and Detection','Supply Chain Integrity and Security','Threats and Hazards Identification','Transportation Systems','Cybersecurity','Economic Recovery','Environmental Response/Health and Safety','Fatality Management Services','Infrastructure Systems','Natural and Cultural Resources','On-scene Security, Protection, and Law Enforcement','Risk and Disaster Resilience Assessment'];
const ALL=[...PROJECT_FIELD_KEYS];
export const DEFAULT_PROJECT_FIELDS_BY_PROGRAM={SHSP:ALL,UASI:ALL,SLCGP:['investment'],NSGP:[],EMPG:[]};
export function programCodeOf(program){return canonicalProgramCode(program?.code||program?.name)}
export function normalizeProjectFieldConfig(program,nofo,coreCapabilities=FEMA_CORE_CAPABILITIES){
 const code=programCodeOf(program), base=program?.project_field_config||{};
 const override=nofo?.project_field_config?.override===true||nofo?.project_field_config?.override_enabled===true;
 const source=override?(nofo.project_field_config||{}):base;
 return {visible:Array.isArray(source.visible)?source.visible:(DEFAULT_PROJECT_FIELDS_BY_PROGRAM[code]||[]),completion_role:source.completion_role||'Subrecipient',investmentOptions:Array.isArray(nofo?.project_investments)?nofo.project_investments:[],nationalPriorityAreas:Array.isArray(nofo?.national_priority_areas)?nofo.national_priority_areas:[],coreCapabilities:Array.isArray(coreCapabilities)&&coreCapabilities.length?coreCapabilities:FEMA_CORE_CAPABILITIES,requiredIjAttachment:code==='NSGP',programCode:code};
}
export function savedValueNeedsReview(value,options=[]){return !!value&&Array.isArray(options)&&options.length>0&&!options.includes(value)}
