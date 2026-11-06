import {accountError, normalizedState} from './accountPolicy.js';

export function organizationIdsFor(account) {
  const ids = Array.isArray(account?.organization_ids) ? account.organization_ids : [];
  if (ids.length) return ids.map(String);
  return account?.organization_id ? [String(account.organization_id)] : [];
}

export function hasOrganizationAccess(account, organizationId) {
  return organizationIdsFor(account).includes(String(organizationId));
}

export function assertOrganizationAccess(account, organizationId) {
  if (account?.role !== 'user') return;
  if (!hasOrganizationAccess(account, organizationId)) throw accountError(403, 'You do not belong to this organization');
}

export async function syncMemberships(db, actor, target, organizationIds) {
  const ids = [...new Set((Array.isArray(organizationIds) ? organizationIds : []).map(String).filter(Boolean))];
  if (target.role === 'user' && !ids.length) throw accountError(400, 'Assign at least one organization to a subrecipient');
  const organizations = ids.length ? (await db.query('SELECT id,name,state,is_active FROM organizations WHERE id::text = ANY($1::text[])', [ids])).rows : [];
  if (organizations.length !== ids.length) throw accountError(400, 'One or more selected organizations do not exist');
  if (organizations.some(org => org.is_active === false)) throw accountError(400, 'All selected organizations must be active');
  if (actor.role !== 'isc_admin') {
    const actorState = normalizedState(actor.scope_state || actor.grantee_state);
    if (!actorState || organizations.some(org => normalizedState(org.state) !== actorState)) throw accountError(403, 'You can only assign organizations in your state');
  }
  await db.query('DELETE FROM user_organizations WHERE user_id=$1', [target.id]);
  for (const organization of organizations) {
    await db.query('INSERT INTO user_organizations(user_id,organization_id) VALUES($1,$2)', [target.id, organization.id]);
  }
  const primary = organizations[0] || null;
  await db.query('UPDATE users SET organization_id=$2,organization_name=$3,scope_state=$4,updated_date=NOW() WHERE id=$1', [target.id, primary?.id || null, primary?.name || null, primary ? normalizedState(primary.state) : null]);
  return organizations;
}
