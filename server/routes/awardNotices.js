import {Router} from 'express';
import {readAwardNoticeHistory} from '../services/documents/awardNoticeRead.js';
export function createAwardNoticeRouter(db,authenticate) {
  const router=Router();router.use(authenticate);
  router.get('/applications/:id',async(req,res)=>{try{res.json(await readAwardNoticeHistory(db,req.user.id,req.params.id));}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to load GAN history'});}});
  return router;
}
