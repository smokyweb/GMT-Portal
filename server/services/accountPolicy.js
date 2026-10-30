export function accountError(status, message) {
  return Object.assign(new Error(message), { status });
}
export function normalizedState(value) {
  return String(value || '').trim().toUpperCase();
}
export function requireAccountAdmin(actor) {
  if (!['admin', 'isc_admin'].includes(actor?.role)) throw accountError(403, 'Administrator access required');
}
export function canManageAccount(actor, target) {
  if (actor?.role === 'isc_admin') return true;
  if (actor?.role !== 'admin' || target?.role !== 'user') return false;
  if (actor.grantee_id && actor.grantee_id !== target.grantee_id) return false;
  const state = normalizedState(actor.scope_state || actor.grantee_state);
  return Boolean(state && state === normalizedState(target.scope_state || target.organization_state));
}
export function assertAccountAccess(actor, target) {
  requireAccountAdmin(actor);
  if (!target) throw accountError(404, 'User not found');
  if (!canManageAccount(actor, target)) throw accountError(403, 'You can only manage subrecipients in your assigned state');
}
export function validateInvite(actor, input, organization) {
  requireAccountAdmin(actor);
  const email = String(input.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw accountError(400, 'Enter a valid email address');
  const role = input.role || 'user';
  if (!['user', 'reviewer', 'admin', 'isc_admin'].includes(role)) throw accountError(400, 'Invalid role');
  if (actor.role !== 'isc_admin' && role !== 'user') throw accountError(403, 'State administrators may invite subrecipients only');
  if (role === 'user' && !organization) throw accountError(400, 'Select an organization for the subrecipient');
  const scopeState = normalizedState(organization?.state || input.scope_state);
  if(organization&&input.scope_state&&normalizedState(input.scope_state)!==normalizedState(organization.state)) throw accountError(400,'State does not match the selected organization');
  const granteeId = input.grantee_id || actor.grantee_id || null;
  const target = { role, scope_state: scopeState, grantee_id: granteeId };
  assertAccountAccess(actor, target);
  if (organization && organization.is_active === false) throw accountError(400, 'This organization is inactive');
  if (scopeState && !/^[A-Z]{2}$/.test(scopeState)) throw accountError(400, 'State must use a two-letter code');
  if (role !== 'isc_admin' && !scopeState) throw accountError(400, 'Select a state for this account');
  return { email, role, scope_state: scopeState, grantee_id: granteeId,
    full_name: String(input.full_name || '').trim() || email.split('@')[0],
    organization_id: organization?.id || null, organization_name: organization?.name || null, phone:String(input.phone||'').trim().slice(0,50) };
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw accountError(400, 'Use a password between 12 and 128 characters');
  }
}
export function publicAccount(row) {
  if (!row) return row;
  const { password_hash, auth_version, ...safe } = row;
  return safe;
}
