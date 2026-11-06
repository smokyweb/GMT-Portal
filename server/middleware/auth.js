import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
export function generateToken(user) {
  return jwt.sign({ id:user.id,email:user.email,role:user.role,full_name:user.full_name,av:user.auth_version||0 },
    JWT_SECRET,{ expiresIn:'7d' });
}
export function createAuthentication(db=pool) {
  return async function authenticate(req,res,next) {
    const header=req.headers.authorization;
    const cookieToken=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('gmt_token='))?.slice('gmt_token='.length);
    const token=header?.startsWith('Bearer ')?header.slice(7):cookieToken;
    if(!token) return res.status(401).json({error:'Missing token'});
    try {
      const claims=jwt.verify(token,JWT_SECRET);
      const {rows}=await db.query(`SELECT u.*, COALESCE((SELECT array_agg(uo.organization_id::text ORDER BY uo.organization_id::text) FROM user_organizations uo WHERE uo.user_id=u.id::text), CASE WHEN u.organization_id IS NOT NULL THEN ARRAY[u.organization_id::text] ELSE ARRAY[]::text[] END) AS organization_ids FROM users u WHERE u.id=$1`,[claims.id]);
      const user=rows[0];
      if(!user || ['inactive','deactivated','invited'].includes(user.active_status)
        || Number(claims.av||0)!==Number(user.auth_version||0)) {
        return res.status(401).json({error:'Your session has expired. Please sign in again.'});
      }
      delete user.password_hash;
      req.user=user;
      if(user.password_change_required && !['/api/auth/me','/api/accounts/change-password'].includes(req.originalUrl.split('?')[0])) {
        return res.status(403).json({error:'Change your temporary password before continuing',password_change_required:true});
      }
      next();
    } catch(error) {
      if(error.name==='JsonWebTokenError'||error.name==='TokenExpiredError') return res.status(401).json({error:'Invalid token'});
      console.error('Authentication lookup failed:',error.code||error.name);
      return res.status(503).json({error:'Unable to verify your session'});
    }
  };
}
export const authRequired=createAuthentication();
export function authOptional(req,res,next) {
  if(req.headers.authorization?.startsWith('Bearer ')) return authRequired(req,res,next);
  next();
}
export function requireRole(...roles) {
  return (req,res,next)=>{
    if(!req.user) return res.status(401).json({error:'Not authenticated'});
    if(!roles.includes(req.user.role)) return res.status(403).json({error:'Insufficient permissions'});
    next();
  };
}
