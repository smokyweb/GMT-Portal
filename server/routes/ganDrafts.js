import {Router} from 'express';
import {saveGanDraft} from '../services/documents/ganDrafts.js';
import {readGanDraft} from '../services/documents/ganDraftRead.js';
// Staging factory only. No production startup import, mount or migration.
export function createGanDraftRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw new Error('GAN drafts require a scoped database and authentication');
  const router=Router();router.use(authenticate);
  const handle=action=>async(req,res)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    try{await action(req,res);}catch(error){
      if(!error.status)console.error('GAN draft:',error.code||error.name);
      res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the GAN draft operation',...(error.details?{details:error.details}:{})});
    }
  };
  router.post('/applications/:id/draft',handle(async(req,res)=>{
    const result=await saveGanDraft(db,req.user.id,req.params.id,req.body,req.ip);res.status(result.replayed?200:201).json(result);
  }));
  const revision=req=>req.query.revision===undefined?undefined:Number(req.query.revision);
  router.get('/documents/:id',handle(async(req,res)=>{
    const {pdf,...result}=await readGanDraft(db,req.user.id,req.params.id,revision(req));void pdf;res.json(result);
  }));
  router.get('/documents/:id/pdf',handle(async(req,res)=>{
    const result=await readGanDraft(db,req.user.id,req.params.id,revision(req));
    res.set({'Content-Type':'application/pdf','Content-Disposition':'inline; filename="gan-'+result.document.id+'-r'+result.document.revision+'-draft.pdf"',
      'X-GMT-Document-SHA256':result.document.pdf_sha256,'X-GMT-Document-Preview':'true'});
    res.send(result.pdf);
  }));
  return router;
}
