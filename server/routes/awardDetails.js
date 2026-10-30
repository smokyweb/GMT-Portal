import {Router} from 'express';
import pool from '../db/connection.js';
import {authRequired} from '../middleware/auth.js';
import {readAwardDetails,saveAwardDetails} from '../services/awards/awardDetails.js';
import {mutateAwardNofo} from '../services/awards/nofoRecords.js';
const handle=action=>async(req,res)=>{try{await action(req,res);}catch(error){if(!error.status)console.error('Award operation:',error.message);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the award operation'});}};
export function createAwardDetailsRouter(db=pool,authenticate=authRequired) {
  const router=Router();router.use(authenticate);
  router.get('/applications/:id',handle(async(req,res)=>res.json(await readAwardDetails(db,req.user.id,req.params.id))));
  router.put('/applications/:id',handle(async(req,res)=>res.json(await saveAwardDetails(db,req.user.id,req.params.id,req.body))));
  return router;
}
export function createAwardNofoEntityRouter(db=pool,authenticate=authRequired) {
  const router=Router();
  router.post('/Nofo',authenticate,handle(async(req,res)=>res.status(201).json(await mutateAwardNofo(db,req.user.id,null,req.body,'POST'))));
  router.put('/Nofo/:id',authenticate,handle(async(req,res)=>res.json(await mutateAwardNofo(db,req.user.id,req.params.id,req.body))));
  router.delete('/Nofo/:id',authenticate,handle(async(req,res)=>res.json(await mutateAwardNofo(db,req.user.id,req.params.id,{},'DELETE'))));
  return router;
}
