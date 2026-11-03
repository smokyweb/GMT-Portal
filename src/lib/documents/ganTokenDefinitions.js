const definitions={};
const add=(record,screen,fields)=>{for(const [token,field] of Object.entries(fields))definitions[token]={record,screen,field};};
add('Nofo','NOFOs › Edit NOFO',{grant_year:'fiscal_year',full_grant_name:'program_name',federal_grant_title:'program_name',state_grant_number:'state_grant_number',
  cfda_title:'cfda_title',total_federal_award:'total_federal_award',statutory_authority:'statutory_authority',federal_award_description:'federal_award_description',
  indirect_cost_rate:'indirect_cost_rate',is_r_and_d:'is_r_and_d',indirect_rd_statement:'indirect_rd_statement',payment_method:'payment_method',cost_share_requirement:'match_requirement'});
add('GrantProgram','Grant Programs',{federal_granting_agency:'federal_agency',program_code:'code',program_name:'name'});
add('AwardDetails','Applications › Review › Award Details',{subaward_number:'subaward_number',federal_award_number:'federal_award_number',federal_award_date:'federal_award_date',
  cfda_number:'cfda_number',total_award_amount:'awarded_amount',amount_this_action:'awarded_amount',match_amount:'match_amount',
  performance_start_date:'award_start',performance_end_date:'award_close',award_record:'id'});
add('Application','Applications › Review',{application_number:'application_number',project_title:'project_title',scope_of_work_summary:'project_narrative',
  nofo_title:'nofo_title',requested_amount:'requested_amount'});
add('Organization','Organizations › Edit Organization',{organization_name:'name',site_name:'site_name',organization_address:'address',organization_uei:'sam_uei',organization_tax_id:'ein'});
add('User','Organization › Authorized Official',{authorized_official_name:'full_name',authorized_official_title:'title',authorized_official_email:'email',authorized_official_phone:'phone'});
add('Grantee','Admin Hub › Grantee Settings',{passthrough_entity:'agency_name',passthrough_contact_name:'contact_name',passthrough_contact_title:'contact_title',
  passthrough_contact_phone:'contact_phone',passthrough_contact_email:'contact_email',approving_official_name:'approving_official_name',approving_official_title:'approving_official_title'});
add('GeneratedDocument','Generate Award Documents',{prepared_by:'prepared_by',award_date:'award_date',gan_due_date:'due_date'});
for(const token of ['budget_planning','budget_organization','budget_equipment','budget_training','budget_exercises','budget_ma','budget_total'])definitions[token]={record:'ApplicationBudget',screen:'Application › Budget / Bulk Upload',field:'poete'};
for(const token of ['projects','project_breakdown','match_total','projects[].project_id','projects[].name','projects[].poete','projects[].federal','projects[].match'])definitions[token]={record:'Project',screen:'Application › Projects',field:token.split('.').at(-1)};
export const GAN_TOKEN_DEFINITIONS=Object.freeze(definitions);
export const GAN_OPTIONAL_TOKENS=new Set(['site_name','indirect_rd_statement']);
export const GAN_TOKEN_ALIASES={awarded_amount:'total_award_amount',performance_start:'performance_start_date',performance_end:'performance_end_date',today_date:'award_date'};
