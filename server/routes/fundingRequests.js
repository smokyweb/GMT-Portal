import {Router} from 'express';
import pool from '../db/connection.js';
import {authRequired} from '../middleware/auth.js';
import {ehpHandle} from './ehp.js';
import {submitFundingRequest} from '../services/ehp/fundingSubmit.js';
import {mutateFunding} from '../services/ehp/fundingMutations.js';
export function createFundingRequestRouter(db=pool,authenticate=authRequired,verifyFile=undefined) {
  const router=Router();router.post('/submit',authenticate,ehpHandle(async(req,res)=>res.status(201).json(await submitFundingRequest(db,req.user.id,req.body,verifyFile))));return router;
}
export function createFundingEntityRouter(db=pool,authenticate=authRequired) {
  const router=Router();
  for(const entity of ['FundingRequest','FundingRequestLineItem']) {
    router.post('/'+entity,authenticate,ehpHandle(async(req,res)=>res.status(201).json(await mutateFunding(db,req.user.id,entity,null,req.body,'POST'))));
    router.put('/'+entity+'/:id',authenticate,ehpHandle(async(req,res)=>res.json(await mutateFunding(db,req.user.id,entity,req.params.id,req.body))));
    router.delete('/'+entity+'/:id',authenticate,ehpHandle(async(req,res)=>res.json(await mutateFunding(db,req.user.id,entity,req.params.id,{},'DELETE'))));
  }return router;
}
