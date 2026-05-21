/**
 * Central permissions module for the GMT Portal.
 *
 * ROLE HIERARCHY (highest → lowest):
 *  federal_admin    – Full system visibility; manage all states, orgs, programs
 *  federal_officer  – Read-only across all states; no write access
 *  admin            – State-scoped admin: manage orgs, apps, flags within their state
 *  reviewer         – State-scoped reviewer: review apps/reports; cannot manage orgs or users
 *  isc_admin        – ISC portal administrator
 *  user             – Organization-scoped subrecipient: own org data only
 */

// ─── Role predicates ──────────────────────────────────────────────────────────

export const isFederalAdmin   = (role) => role === 'federal_admin';
export const isFederalOfficer = (role) => role === 'federal_officer' || role === 'federal_admin';
export const isFederal        = (role) => role === 'federal_admin' || role === 'federal_officer';
export const isStateAdmin     = (role) => role === 'admin';
export const isStateReviewer  = (role) => role === 'reviewer';
export const isIscAdmin       = (role) => role === 'isc_admin';
export const isSubrecipient   = (role) => role === 'user';

// A "state user" is anyone who operates at the state level or above (non-subrecipient, non-isc)
export const isStateUser = (role) =>
  role === 'admin' || role === 'reviewer' || role === 'federal_admin' || role === 'federal_officer';

// Admin = any user who has write/manage access (state admin or federal admin)
export const isAdmin = (role) => role === 'admin' || role === 'federal_admin';

// Can the user manage other users?
export const canManageUsers = (role) => role === 'admin' || role === 'federal_admin';

// Can the user access cross-state data?
export const canViewAllStates = (role) => role === 'federal_admin' || role === 'federal_officer';

// Can the user manage grant programs and NOFOs at a system level?
export const canManagePrograms = (role) => role === 'federal_admin';

// Can the user approve/deny applications?
export const canReviewApplications = (role) => role === 'admin' || role === 'reviewer' || role === 'federal_admin';

// Can the user create compliance flags?
export const canCreateFlags = (role) => role === 'admin' || role === 'reviewer' || role === 'federal_admin';

// Can the user resolve compliance flags?
export const canResolveFlags = (role) => role === 'admin' || role === 'federal_admin';

// Can the user view analytics/financials dashboards?
export const canViewAnalytics = (role) =>
  role === 'admin' || role === 'federal_admin' || role === 'federal_officer';

// Can the user manage workflow rules?
export const canManageWorkflow = (role) => role === 'admin' || role === 'federal_admin';

// ─── Scope helpers ────────────────────────────────────────────────────────────

/**
 * Returns true if `user` has access to data belonging to `targetState`.
 * Federal users see all states; state users only see their own state.
 */
export const canAccessState = (user, targetState) => {
  if (!user) return false;
  if (isFederal(user.role)) return true;
  if (!targetState) return true; // unscoped record
  return user.scope_state === targetState;
};

/**
 * Returns true if `user` has access to data belonging to `orgId`.
 * Federal/state users see all orgs in scope; subrecipients only their own.
 */
export const canAccessOrg = (user, orgId) => {
  if (!user) return false;
  if (isFederal(user.role) || isStateAdmin(user.role) || isStateReviewer(user.role)) return true;
  return user.organization_id === orgId;
};

// ─── Role display labels ──────────────────────────────────────────────────────

export const ROLE_LABELS = {
  federal_admin:   'Federal Administrator',
  federal_officer: 'Federal Program Officer',
  admin:           'State Administrator',
  reviewer:        'State Reviewer',
  isc_admin:       'ISC Administrator',
  user:            'Subrecipient',
};

export const ROLE_BADGE_CONFIG = {
  federal_admin:   { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-600' },
  federal_officer: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
  admin:           { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-600'   },
  reviewer:        { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-500'    },
  isc_admin:       { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-600'   },
  user:            { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500'  },
};

export const getRoleLabel = (role) => ROLE_LABELS[role] || role || 'Unknown';
export const getRoleBadge = (role) => ROLE_BADGE_CONFIG[role] || ROLE_BADGE_CONFIG.user;