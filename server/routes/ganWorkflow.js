import {readGanSendReadiness} from '../services/documents/ganIssueReadiness.js';
import {listGanWorkflows} from '../services/documents/ganWorkflowCatalog.js';
import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {formActor,auditForm} from '../services/forms/formAccess.js';
import {accountError} from '../services/accountPolicy.js';
import {transitionGan} from '../services/documents/ganWorkflow.js';
import {readGanWorkflow,readGanIssuePdf} from '../services/documents/ganWorkflowRead.js';
import {ganSignatureSettings,saveGanSignatureSettings} from '../services/documents/ganSignatureSettings.js';
// Explicit isolated-stage factory. It never mounts itself or sends provider email.
export function createGanWorkflowRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw Error('GAN workflow requires scoped storage and authentication');
  const router=Router();router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});next();});router.use(authenticate);
  const handle=action=>async(req,res)=>{try{await action(req,res);}catch(error){if(!error.status)console.error('GAN workflow:',error.code||error.name);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the GAN workflow action',...(error.details?{details:error.details}:{})});}};
  router.get('/workflow-documents',handle(async(req,res)=>res.json(await listGanWorkflows(db,req.user.id))));
  router.get('/documents/:id/send-readiness',handle(async(req,res)=>res.json(await readGanSendReadiness(db,req.user.id,req.params.id,req.query.packageId))));
  router.get('/documents/:id/workflow',handle(async(req,res)=>res.json(await readGanWorkflow(db,req.user.id,req.params.id))));
  router.post('/documents/:id/actions/:action',handle(async(req,res)=>res.json(await transitionGan(db,req.user.id,req.params.id,req.params.action,req.body,req.ip))));
  router.get('/issues/:id/pdf',handle(async(req,res)=>{
    let result=await readGanIssuePdf(db,req.user.id,req.params.id);
    if(result.actor.role==='user'){
      const state=await readGanWorkflow(db,req.user.id,result.document.id);
      if(state.issue?.id===result.issue.id&&state.phase==='Sent'){
        try{await transitionGan(db,req.user.id,result.document.id,'open',{requestId:randomUUID(),expectedRevision:state.revision},req.ip);}
        catch(error){if(error.status!==409)throw error;const current=await readGanWorkflow(db,req.user.id,result.document.id);if(current.phase==='Sent')throw error;}
        result=await readGanIssuePdf(db,req.user.id,req.params.id);
      }
    }
    const downloading=req.query.download==='1';
    await auditForm(db,result.actor,result.document.id,downloading?'GANIssuedPackageDownloaded':'GANIssuedPackagePreviewed','Issue '+result.issue.id+'; '+result.stage+'; PDF SHA-256 '+result.pdf_sha256+'; observed IP: '+String(req.ip).slice(0,100),'GeneratedDocument');
    res.set({'Content-Type':'application/pdf','Content-Disposition':(downloading?'attachment':'inline')+'; filename="gan-'+result.document.id+'-'+result.stage+'.pdf"','X-GMT-Document-SHA256':result.pdf_sha256,'X-GMT-Document-Stage':result.stage});
    res.send(result.pdf);
  }));
  router.get('/templates/:id/signing-settings',handle(async(req,res)=>{const actor=await formActor(db,req.user.id);if(actor.role!=='isc_admin')throw accountError(403,'Only ISC administrators manage shared template signing settings');res.json(await ganSignatureSettings(db,req.params.id));}));
  router.put('/templates/:id/signing-settings',handle(async(req,res)=>res.json(await saveGanSignatureSettings(db,req.user.id,req.params.id,req.body))));
  return router;
}
