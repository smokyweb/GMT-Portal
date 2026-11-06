// Address Book # (vendor_number) is a Nebraska-managed organization identifier,
// not an imported legacy field. It remains editable and is validated as unique.
export const LEGACY_ORG_FIELDS=['legacy_spars_id','duns','region'];
export const LEGACY_GRANTEE_FIELDS=['legacy_fields_enabled','legacy_system_name'];
export const LEGACY_NOFO_FIELDS=['legacy_grant_id'];
export const LEGACY_PROJECT_FIELDS=['legacy_project_id'];
export const LEGACY_FUNDING_LINE_FIELDS=['legacy_expenditure_id'];
export const LEGACY_BUDGET_FIELDS=['legacy_budget_line_id'];
export const LEGACY_FUNDING_REQUEST_FIELDS=['legacy_reimbursement_id'];
export const LEGACY_APPLICATION_FIELDS=['legacy_subaward_id'];
export async function legacyContext(db,actor,requestedGranteeId=null){let grantee=null;if(actor?.role==='isc_admin'&&requestedGranteeId)grantee=(await db.query('SELECT id,name,state_code,legacy_fields_enabled,legacy_system_name FROM grantees WHERE id::text=$1',[requestedGranteeId])).rows[0]||null;else if(actor?.grantee_id)grantee=(await db.query('SELECT id,name,state_code,legacy_fields_enabled,legacy_system_name FROM grantees WHERE id::text=$1',[actor.grantee_id])).rows[0]||null;else if(actor?.scope_state)grantee=(await db.query('SELECT id,name,state_code,legacy_fields_enabled,legacy_system_name FROM grantees WHERE upper(state_code)=upper($1) ORDER BY is_active DESC,name LIMIT 1',[actor.scope_state])).rows[0]||null;const enabled=Boolean(grantee?.legacy_fields_enabled);return{grantee,enabled,canEdit:enabled&&['admin','isc_admin'].includes(actor?.role)}}
export function hasLegacyFields(input={},fields=LEGACY_ORG_FIELDS){return fields.some(key=>Object.prototype.hasOwnProperty.call(input,key)&&input[key]!==null&&String(input[key]).trim()!=='')}
export function stripLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_ORG_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripNofoLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_NOFO_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripProjectLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_PROJECT_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripFundingLineLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_FUNDING_LINE_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripBudgetLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_BUDGET_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripFundingRequestLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_FUNDING_REQUEST_FIELDS.forEach(key=>delete clean[key]);return clean}
export function stripApplicationLegacyFields(row,enabled){if(enabled)return row;const clean={...row};LEGACY_APPLICATION_FIELDS.forEach(key=>delete clean[key]);return clean}
export function assertLegacyProjectMutation(actor,input={},context){if(Object.prototype.hasOwnProperty.call(input,'legacy_project_id')&&!context.canEdit){const error=new Error('Legacy project fields are not enabled for this Grantee or you do not have edit permission');error.status=403;throw error}}
export function assertLegacyFundingLineMutation(actor,input={},context){if(Object.prototype.hasOwnProperty.call(input,'legacy_expenditure_id')&&input.legacy_expenditure_id!==null&&String(input.legacy_expenditure_id).trim()!==''&&!context.canEdit){const error=new Error('Legacy funding fields are not enabled for this Grantee or you do not have edit permission');error.status=403;throw error}}
export function assertLegacyFundingRequestMutation(actor,input={},context){if(Object.prototype.hasOwnProperty.call(input,'legacy_reimbursement_id')){const error=new Error('Legacy reimbursement fields are import-managed and read-only');error.status=403;throw error}}
export function assertLegacyGranteeMutation(actor,input={}){if(LEGACY_GRANTEE_FIELDS.some(key=>Object.prototype.hasOwnProperty.call(input,key))&&actor?.role!=='isc_admin'){const error=new Error('Only ISC administrators can edit legacy field settings');error.status=403;throw error}}
export function assertLegacyOrganizationMutation(actor,input={},context){if(hasLegacyFields(input)&&!context.canEdit){const error=new Error('Legacy fields are not enabled for this Grantee or you do not have edit permission');error.status=403;throw error}}
export function assertLegacyNofoMutation(actor,input={},context){if(hasLegacyFields(input,LEGACY_NOFO_FIELDS)&&!context.canEdit){const error=new Error('Legacy fields are not enabled for this Grantee or you do not have edit permission');error.status=403;throw error}}
