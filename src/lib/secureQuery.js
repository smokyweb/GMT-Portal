/**
 * Frontend helper to call the RLS-enforced secureQuery backend function.
 *
 * Usage:
 *   import { secureQuery } from '@/lib/secureQuery';
 *   const applications = await secureQuery('Application', { status: 'Submitted' }, '-created_date', 50);
 *
 * The backend enforces data isolation automatically based on the caller's role:
 *   - federal_admin / federal_officer  → all data
 *   - admin / reviewer (state)         → state-scoped (scope_state)
 *   - user (subrecipient)              → own organization only
 */

import { base44 } from '@/api/base44Client';

export async function secureQuery(entity, filters = {}, sort = '-created_date', limit = 100) {
  const response = await base44.functions.invoke('secureQuery', { entity, filters, sort, limit });
  return response.data?.data ?? [];
}