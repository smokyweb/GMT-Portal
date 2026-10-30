import { randomBytes, createHash } from 'node:crypto';
import { accountError, assertAccountAccess, normalizedState, requireAccountAdmin } from './accountPolicy.js';
export const hashAccessToken = value => createHash('sha256').update(value).digest('hex');
export async function transaction(pool, action) {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const result = await action(db); await db.query('COMMIT'); return result; }
  catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
export async function findAccount(db, id) {
  const { rows } = await db.query(`SELECT u.*, o.state AS organization_state, g.state_code AS grantee_state
    FROM users u LEFT JOIN organizations o ON o.id::text=u.organization_id
    LEFT JOIN grantees g ON g.id::text=u.grantee_id WHERE u.id=$1`, [id]);
  return rows[0];
}
export async function accountActor(db, id) {
  const actor = await findAccount(db, id);
  if (!actor) throw accountError(401, 'Account no longer exists');
  requireAccountAdmin(actor);
  return actor;
}
export async function listManagedAccounts(db, actor) {
  requireAccountAdmin(actor);
  const values = [];
  let where = '';
  if (actor.role !== 'isc_admin') {
    const state = normalizedState(actor.scope_state || actor.grantee_state);
    if (!state) throw accountError(403, 'Your administrator account has no state assignment');
    values.push(state);
    where = "WHERE u.role='user' AND UPPER(COALESCE(NULLIF(u.scope_state,''),o.state,''))=$1";
    if (actor.grantee_id) { values.push(actor.grantee_id); where += ' AND u.grantee_id=$2'; }
  }
  const { rows } = await db.query(`SELECT u.*, o.state AS organization_state FROM users u
    LEFT JOIN organizations o ON o.id::text=u.organization_id ${where} ORDER BY u.created_date DESC`, values);
  return rows;
}
export async function issueAccessToken(db, userId, purpose) {
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
  const token = randomBytes(32).toString('hex');
  await db.query('UPDATE account_access_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [userId]);
  await db.query(`INSERT INTO account_access_tokens(token_hash,user_id,purpose,expires_at)
    VALUES($1,$2,$3,NOW()+INTERVAL '24 hours')`, [hashAccessToken(token), userId, purpose]);
  return token;
}
export async function auditAccount(db, actor, targetId, action, description, ip) {
  await db.query(`INSERT INTO audit_logs(user_email,user_name,action,entity_type,entity_id,description)
    VALUES($1,$2,$3,'User',$4,$5)`,
    [actor.email, actor.full_name || actor.email, action, targetId, description + (ip ? ' IP: '+ip : '')]);
}
export async function managedTarget(db, actorId, targetId) {
  const actor = await accountActor(db, actorId);
  await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[targetId]);
  const target = await findAccount(db, targetId);
  assertAccountAccess(actor, target);
  return { actor, target };
}
