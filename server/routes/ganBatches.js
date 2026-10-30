import {ganBatchCatalog} from '../services/documents/ganBatchCatalog.js';
import {previewGanBatchRows} from '../services/documents/ganBatchPreview.js';
import {Router} from 'express';
import {createGanBatch} from '../services/documents/ganBatchPlan.js';
import {runGanBatch} from '../services/documents/ganBatchRun.js';
import {readGanBatch} from '../services/documents/ganBatchRead.js';
// Staging-only factory; no startup import or production mount.
export function createGanBatchRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw new Error('GAN batches require a scoped database and authentication');
  const router=Router();router.use(authenticate);
  const handle=action=>async(req,res)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    try{await action(req,res);}catch(error){
      if(!error.status)console.error('GAN batch:',error.code||error.name);
      res.status(error.status||500).json({error:error.status?error.message:'Unable to complete this GAN batch request'});
    }
  };
  router.get('/batch-options',handle(async(req,res)=>res.json(await ganBatchCatalog(db,req.user.id,req.query.nofoId))));
  router.post('/batch-preview',handle(async(req,res)=>res.json(await previewGanBatchRows(db,req.user.id,req.body))));
  router.post('/batches',handle(async(req,res)=>{const result=await createGanBatch(db,req.user.id,req.body,req.ip);res.status(result.replayed?200:201).json(result);}));
  router.get('/batches/:id',handle(async(req,res)=>res.json(await readGanBatch(db,req.user.id,req.params.id))));
  router.post('/batches/:id/run',handle(async(req,res)=>res.json(await runGanBatch(db,req.user.id,req.params.id,req.body,req.ip))));
  return router;
}
