import {Router} from 'express';
import {authRequired} from '../middleware/auth.js';
import {assertSparsImportActor,previewSparsImport,commitSparsImport} from '../services/sparsImport.js';

export function createSparsImportRouter(db,authenticate=authRequired){
  const router=Router();
  router.use(authenticate);
  router.post('/preview',async(req,res)=>{
    try {assertSparsImportActor(req.user);res.json(await previewSparsImport(db,req.user,req.body));}
    catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to preview SPARS import'});}
  });
  router.post('/commit',async(req,res)=>{
    try {assertSparsImportActor(req.user);res.status(201).json(await commitSparsImport(db,req.user,req.body));}
    catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to commit SPARS import'});}
  });
  return router;
}
