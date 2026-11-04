// Shared token repository. Keys match the normalized record fields exposed by the
// template generator; aliases preserve the original placeholder names.
export const TEMPLATE_FIELD_GROUPS = [
  { label: 'Application', fields: [
    ['application_number','Application #'],['organization_name','Organization Name'],['project_title','Project Title'],['project_narrative','Project Narrative'],['work_plan','Work Plan'],['risk_assessment','Risk Assessment'],['requested_amount','Requested Amount'],['awarded_amount','Awarded Amount'],['match_amount','Match Amount'],['total_expended','Total Expended'],['remaining_balance','Remaining Balance'],['expenditure_rate','Expenditure Rate'],['performance_start','Performance Start'],['performance_end','Performance End'],['status','Application Status'],['submitted_by','Submitted By'],['submitted_at','Submitted At'],['program_code','Program Code'],['program_name','Program Name'],
  ]},
  { label: 'Organization', fields: [
    ['organization_name','Organization Name'],['organization_type','Organization Type'],['organization_ein','EIN'],['organization_sam_uei','SAM UEI'],['organization_address','Street Address'],['organization_address_line_2','Address Line 2'],['organization_city','City'],['organization_state','State'],['organization_zip','ZIP'],['organization_county','County'],['organization_region','Region'],['organization_duns','DUNS'],['organization_vendor_number','Address Book #'],['organization_legacy_spars_id','Legacy ID'],['primary_contact_name','Primary Contact Name'],['primary_contact_title','Primary Contact Title'],['primary_contact_email','Primary Contact Email'],['primary_contact_phone','Primary Contact Phone'],
  ]},
  { label: 'NOFO', fields: [
    ['nofo_title','NOFO Title'],['nofo_summary','NOFO Summary'],['fiscal_year','Fiscal Year'],['grant_number','Federal Grant Number (FAIN)'],['state_grant_number','State Grant #'],['cfda_number','Assistance Listing #'],['cfda_title','Assistance Listing Title'],['funding_stream','Funding Stream'],['eligibility_criteria','Eligibility Criteria'],['allowable_costs','Allowable Costs'],['evaluation_criteria','Evaluation Criteria'],['total_funding_available','Total Funding Available'],['total_federal_award','Total Federal Award to State'],['min_award','Minimum Award'],['max_award','Maximum Award'],['organization_award_cap','Per-Organization Award Cap'],['ma_percent','M&A Retained %'],['local_share_amount','Local Share'],['local_share_pct','Local Share %'],['state_share_amount','State Share'],['state_share_pct','State Share %'],['mou_amount','MOU Amount'],['open_date','Application Open Date'],['close_date','Application Close Date'],['federal_award_date','Federal Award Date'],['federal_close_date','Federal Close Date'],['federal_performance_start','Federal PoP Start'],['federal_performance_end','Federal PoP End'],['legacy_grant_id','Legacy Grant ID'],
  ]},
  { label: 'Grant Program', fields: [
    ['program_name','Program Name'],['program_code','Program Code'],['program_description','Program Description'],['program_federal_agency','Federal Agency'],['program_cfda_number','Program Assistance Listing #'],['program_eligibility_criteria','Program Eligibility Criteria'],['program_allowable_costs','Program Allowable Costs'],['program_compliance_requirements','Program Compliance Requirements'],['program_reporting_requirements','Program Reporting Requirements'],
  ]},
  { label: 'Grantee', fields: [
    ['grantee_name','Grantee Name'],['grantee_state','Grantee State'],['grantee_agency_name','Grantee Agency'],['grantee_contact_name','Grantee Contact Name'],['grantee_contact_email','Grantee Contact Email'],['grantee_contact_phone','Grantee Contact Phone'],['grantee_address','Grantee Address'],['grantee_city','Grantee City'],['grantee_zip','Grantee ZIP'],['grantee_legacy_system_name','Legacy System Name'],
  ]},
  { label: 'User', fields: [
    ['user_full_name','User Full Name'],['user_email','User Email'],['user_title','User Title'],['user_department','User Department'],['user_phone','User Phone'],
  ]},
  { label: 'System', fields: [
    ['today_date',"Today's Date"],['projects','Projects (repeating rows)'],
  ]},
];

export const TEMPLATE_FIELDS = TEMPLATE_FIELD_GROUPS.flatMap(group => group.fields.map(([key,label]) => ({key,label,group:group.label})));
