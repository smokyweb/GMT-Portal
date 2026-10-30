import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/connection.js';
import { generateToken, createAuthentication } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../email.js';
import { publicAccount } from '../services/accountPolicy.js';
export function createAuthRouter(db=pool, welcome=sendWelcomeEmail) {
  const router=Router();
  const authenticate=createAuthentication(db);
  router.post('/register',async(req,res)=>{
    const {email,password,full_name,role}=req.body;
    if(!email||!password) return res.status(400).json({error:'email and password are required'});
    if(role && role!=='user') return res.status(403).json({error:'Administrator accounts require an administrator invitation'});
    try {
      const normalized=String(email).trim().toLowerCase();
      const existing=await db.query('SELECT id FROM users WHERE LOWER(email)=$1',[normalized]);
      if(existing.rows.length) return res.status(409).json({error:'Email already registered'});
      const hash=await bcrypt.hash(password,12);
      const {rows}=await db.query(`INSERT INTO users(email,full_name,password_hash,role)
        VALUES($1,$2,$3,'user') RETURNING *`,[normalized,full_name||normalized.split('@')[0],hash]);
      const user=rows[0];
      welcome(user.email,user.full_name).catch(()=>{});
      res.status(201).json({user:publicAccount(user),token:generateToken(user)});
    } catch(error) {
      console.error('Register error:',error.code||error.name);
      res.status(500).json({error:'Registration failed'});
    }
  });
  router.post('/login',async(req,res)=>{
    const {email,password}=req.body;
    if(!email||!password) return res.status(400).json({error:'email and password are required'});
    try {
      const {rows}=await db.query('SELECT * FROM users WHERE LOWER(email)=$1',[String(email).trim().toLowerCase()]);
      const user=rows[0];
      if(!user || ['inactive','deactivated','invited'].includes(user.active_status)
        || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({error:'Invalid credentials'});
      const result=await db.query('UPDATE users SET last_login=NOW() WHERE id=$1 RETURNING *',[user.id]);
      const loggedIn=result.rows[0];
      res.json({user:publicAccount(loggedIn),token:generateToken(loggedIn)});
    } catch(error) {
      console.error('Login error:',error.code||error.name);
      res.status(500).json({error:'Login failed'});
    }
  });
  router.get('/me',authenticate,(req,res)=>res.json(publicAccount(req.user)));
  router.put('/me',authenticate,async(req,res)=>{
    const allowed=['full_name','title','department','phone'];
    const updates=Object.fromEntries(allowed.filter(k=>req.body[k]!==undefined).map(k=>[k,req.body[k]]));
    if(!Object.keys(updates).length) return res.status(400).json({error:'No valid fields to update'});
    try {
      const keys=Object.keys(updates);
      const {rows}=await db.query(`UPDATE users SET ${keys.map((key,i)=>key+'=$'+(i+2)).join(',')},updated_date=NOW()
        WHERE id=$1 RETURNING *`,[req.user.id,...Object.values(updates)]);
      res.json(publicAccount(rows[0]));
    } catch(error) {
      console.error('Update profile error:',error.code||error.name);
      res.status(500).json({error:'Failed to update profile'});
    }
  });
  return router;
}
export default createAuthRouter();
