import {Router} from 'express';
import pool from '../db/connection.js';
import {authRequired} from '../middleware/auth.js';
import {readEhp,classifyEhpBudget,recordEhpDecision} from '../services/ehp/ehpReview.js';
export const ehpHandle=action=>async(req,res)=>{
  try{await action(req,res);}catch(error){if(!error.status)console.error('EHP/funding operation:',error.message);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete EHP or funding operation',...(error.details?{details:error.details}:{})});}
};
export function createEhpRouter(db=pool,authenticate=authRequired) {
  const router=Router();router.use(authenticate);
  router.get('/applications/:id',ehpHandle(async(req,res)=>res.json(await readEhp(db,req.user.id,req.params.id))));
  router.put('/applications/:id/decision',ehpHandle(async(req,res)=>res.json(await recordEhpDecision(db,req.user.id,req.params.id,req.body))));
  router.put('/applications/:id/budgets/:lineId',ehpHandle(async(req,res)=>res.json(await classifyEhpBudget(db,req.user.id,req.params.id,req.params.lineId,req.body))));
  return router;
}
