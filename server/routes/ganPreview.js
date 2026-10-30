import {Router} from 'express';
import {previewGanFromRecords} from '../services/documents/ganContext.js';
import {renderGanPdfPreview} from '../services/documents/ganPdfPreview.js';
// An explicit factory for isolated QA; no production default or startup mount.
export function createGanPreviewRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw new Error('GAN preview requires a scoped database and authentication');
  const router=Router();router.use(authenticate);
  const handle=action=>async(req,res)=>{
    res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
    try{await action(req,res);}catch(error){
      if(!error.status)console.error('GAN preview:',error.code||error.name);
      res.status(error.status||500).json({error:error.status?error.message:'Unable to prepare this GAN preview',...(error.code&&error.status?{code:error.code}:{}),...(error.details?{details:error.details}:{})});
    }
  };
  router.post('/applications/:id/preview',handle(async(req,res)=>{
    const preview=await previewGanFromRecords(db,req.user.id,req.params.id,req.body);
    const template={...preview.template};delete template.body;
    res.json({...preview,template,readyForSending:false});
  }));
  router.post('/applications/:id/preview.pdf',handle(async(req,res)=>{
    const preview=await previewGanFromRecords(db,req.user.id,req.params.id,req.body);
    if(!preview.ready)throw Object.assign(new Error('Resolve the GAN preview issues before rendering its PDF'),{status:422,details:preview.issues});
    const result=renderGanPdfPreview(preview,{programCode:preview.values.program_code,templateBody:preview.template.body,templateVersion:preview.template.version});
    const name=String(preview.values.subaward_number||preview.sources.applicationId).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80);
    res.set({'Content-Type':'application/pdf','Content-Disposition':'inline; filename="'+name+'-draft.pdf"','X-GMT-Document-Preview':'true','X-GMT-Document-SHA256':result.pdf_sha256,'X-GMT-Template-Version':String(result.template_version)});
    res.send(result.pdf);
  }));
  return router;
}
