import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { accountError, publicAccount, validateInvite, validatePassword } from './accountPolicy.js';
import { accountActor, auditAccount, hashAccessToken, issueAccessToken, managedTarget, transaction } from './accountRepository.js';
export function createAccountService(pool, sendLink) {
  const invite = async (actorId, input, ip) => transaction(pool, async db => {
    const actor = await accountActor(db, actorId);
    const organization = input.organization_id
      ? (await db.query('SELECT * FROM organizations WHERE id::text=$1', [input.organization_id])).rows[0] : null;
    const data = validateInvite(actor, input, organization);
    const exists = await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [data.email]);
    if (exists.rows.length) throw accountError(409, 'This email already has an account. Use Resend invite or Reset password.');
    const passwordHash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
    const activeStatus=data.send_invite?'invited':'active';
    const { rows } = await db.query(`INSERT INTO users
      (email,full_name,password_hash,role,organization_id,organization_name,grantee_id,scope_state,title,phone,active_status,password_change_required)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.email,data.full_name,passwordHash,data.role,data.organization_id,data.organization_name,data.grantee_id,data.scope_state,data.title,data.phone,activeStatus,!data.send_invite]);
    const user = rows[0];
    if(data.send_invite){const token = await issueAccessToken(db,user.id,'invite');await sendLink(user, token, 'invite');}
    await auditAccount(db,actor,user.id,'UserInvited',data.send_invite?'Set-password invitation accepted by mail provider':'POC contact created without a system invitation',ip);
    return { user: publicAccount(user), delivery: data.send_invite?'accepted':'not_sent', ...(data.send_invite?{expires_in_hours:24}:{}) };
  });
  const reset = async (actorId, targetId, input, ip, purpose='reset') => transaction(pool, async db => {
    const {actor,target} = await managedTarget(db,actorId,targetId);
    if (['inactive','deactivated'].includes(target.active_status)) throw accountError(400,'Activate this account before resetting access');
    if(input.method!==undefined&&!['email','temporary'].includes(input.method)) throw accountError(400,'Choose email or temporary password');
    const temporary = input.method === 'temporary';
    if (temporary && purpose === 'invite') throw accountError(400,'Invitations use an emailed set-password link');
    const revoke = input.revoke_sessions !== false;
    let temporaryPassword;
    if (temporary) {
      temporaryPassword = randomBytes(18).toString('base64url');
      const hash = await bcrypt.hash(temporaryPassword,12);
      await db.query(`UPDATE users SET password_hash=$2,password_change_required=true,
        active_status='active',auth_version=auth_version+$3,updated_date=NOW() WHERE id=$1`,[target.id,hash,revoke?1:0]);
      await db.query('UPDATE account_access_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[target.id]);
    } else {
      const token = await issueAccessToken(db,target.id,purpose);
      await sendLink(target,token,purpose);
      if(revoke) await db.query('UPDATE users SET auth_version=auth_version+1 WHERE id=$1',[target.id]);
    }
    await auditAccount(db,actor,target.id,purpose==='invite'?'InviteResent':'PasswordResetRequested',
      (temporary?'Temporary password created; change required at next login':'24-hour set-password link accepted by mail provider')+
      (revoke?'; active sessions revoked':''),ip);
    return { success:true, delivery:temporary?undefined:'accepted', temporary_password:temporaryPassword, expires_in_hours:temporary?undefined:24 };
  });
  const complete = async (token, password, ip) => {
    validatePassword(password);
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)) throw accountError(400,'This link is invalid or expired');
    return transaction(pool,async db=>{
      const {rows}=await db.query(`SELECT t.*,u.email,u.full_name,u.active_status FROM account_access_tokens t
        JOIN users u ON u.id=t.user_id WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()`,
        [hashAccessToken(token)]);
      const access=rows[0];
      if(!access) throw accountError(400,'This link is invalid, expired, or already used');
      const locked=await db.query('SELECT id,active_status FROM users WHERE id=$1 FOR UPDATE',[access.user_id]);
      const valid=await db.query('SELECT token_hash FROM account_access_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[hashAccessToken(token)]);
      if(!valid.rows.length) throw accountError(400,'This link is invalid, expired, or already used');
      if(['inactive','deactivated'].includes(locked.rows[0]?.active_status)) throw accountError(403,'This account is inactive');
      const hash=await bcrypt.hash(password,12);
      await db.query(`UPDATE users SET password_hash=$2,password_change_required=false,active_status='active',
        auth_version=auth_version+1,updated_date=NOW() WHERE id=$1`,[access.user_id,hash]);
      await db.query('UPDATE account_access_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[access.user_id]);
      await auditAccount(db,access,access.user_id,'PasswordChanged',access.purpose==='invite'?'Invitation accepted':'Password reset completed',ip);
      return {success:true};
    });
  };
  const changePassword = async (actorId,password,ip) => {
    validatePassword(password);
    return transaction(pool,async db=>{
      const {rows}=await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[actorId]);
      const user=rows[0];
      if(!user) throw accountError(401,'Account not found');
      if(!user.password_change_required) throw accountError(400,'Use a password reset link to change your password');
      const hash=await bcrypt.hash(password,12);
      await db.query(`UPDATE users SET password_hash=$2,password_change_required=false,
        auth_version=auth_version+1,updated_date=NOW() WHERE id=$1`,[actorId,hash]);
      await auditAccount(db,user,actorId,'PasswordChanged','Required temporary password change completed',ip);
      return {success:true};
    });
  };
  return {invite,reset,complete,changePassword};
}
