import {accountError, normalizedState} from './accountPolicy.js';
import {organizationIdsFor} from './organizationMembership.js';

// Files are intentionally downloadable only when they are referenced by a
// portal record the caller can already view. An uploaded file that has not
// yet been attached to a record is not a public object.
export async function assertFileAccess(db, actor, filename) {
  const url = `/api/files/${filename}`;
  const references = (await db.query(`
    SELECT d.organization_id, d.application_id, a.organization_id AS application_organization_id
      FROM documents d
      LEFT JOIN applications a ON a.id::text=d.application_id::text
     WHERE d.file_url=$1
    UNION ALL
    SELECT g.organization_id, g.application_id, a2.organization_id
      FROM generated_documents g
      LEFT JOIN applications a2 ON a2.id::text=g.application_id::text
     WHERE g.file_url=$1
    UNION ALL
    SELECT NULL, NULL, NULL
      FROM document_templates t
     WHERE t.file_url=$1 AND t.is_active=true`, [url])).rows;
  if (!references.length) throw accountError(404, 'File not found');
  if (['federal_admin','federal_officer','isc_admin'].includes(actor?.role)) return;

  const organizationIds = references
    .map(row => row.organization_id || row.application_organization_id)
    .filter(Boolean)
    .map(String);
  if (actor?.role === 'user') {
    const members = new Set(organizationIdsFor(actor).map(String));
    if (organizationIds.some(id => members.has(id))) return;
    // Active global templates have no organization and are safe for signed-in
    // users to download; organization records above remain membership-scoped.
    if (references.some(row => !row.organization_id && !row.application_organization_id)) return;
    throw accountError(403, 'You do not belong to this organization');
  }

  const state = normalizedState(actor?.scope_state || actor?.grantee_state);
  if (!state || !organizationIds.length) throw accountError(403, 'This file is outside your assigned state');
  const allowed = (await db.query(
    `SELECT 1 FROM organizations WHERE id::text=ANY($1::text[]) AND upper(btrim(COALESCE(state,'')))=$2 LIMIT 1`,
    [organizationIds, state]
  )).rows.length > 0;
  if (!allowed) throw accountError(403, 'This file is outside your assigned state');
}
