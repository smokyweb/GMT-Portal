import {Router} from 'express';
import multer from 'multer';
import {accountError} from '../services/accountPolicy.js';
import {auditForm} from '../services/forms/formAccess.js';
import {ganAttachmentAccess,listGanAttachments,saveGanAttachment,readGanAttachment} from '../services/documents/ganAttachments.js';
import {saveGanPackage} from '../services/documents/ganPackages.js';
import {listGanPackages,readGanPackage,readGanPackagePart} from '../services/documents/ganPackageRead.js';
import {MAX_GAN_ATTACHMENT_BYTES} from '../services/documents/pdf/ganAttachmentPdf.js';
// Explicit stage factory only; not imported or mounted in production.
export function createGanPackageRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw Error('GAN packages require scoped storage and authentication');
  const router=Router();router.use(authenticate);router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});next();});
  const fail=(error,res)=>{if(!error.status)console.error('GAN package:',error.code||error.name);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the GAN package operation'});};
  const handle=action=>async(req,res)=>{try{await action(req,res);}catch(error){fail(error,res);}};
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_GAN_ATTACHMENT_BYTES,files:1,fields:4,fieldSize:2048,parts:6}});
  const send=(res,pdf,sha,filename)=>{res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+filename+'"','X-GMT-Document-SHA256':sha,'X-GMT-Document-Preview':'true'});res.send(pdf);};
  router.get('/nofos/:id/attachments',handle(async(req,res)=>res.json({attachments:await listGanAttachments(db,req.user.id,req.params.id)})));
  router.post('/nofos/:id/attachments',handle(async(req,res)=>{
    await ganAttachmentAccess(db,req.user.id,req.params.id);
    upload.single('file')(req,res,async error=>{
      try {
        if(error)throw accountError(error.code==='LIMIT_FILE_SIZE'?413:400,error.code==='LIMIT_FILE_SIZE'?'Choose a PDF no larger than 10 MB':'Upload one PDF with its attachment fields');
        if(!req.file)throw accountError(400,'Choose an attachment PDF');
        let signaturePages;try{signaturePages=JSON.parse(req.body.signaturePages||'[]');}catch{throw accountError(400,'List the signature pages as page numbers');}
        const result=await saveGanAttachment(db,req.user.id,req.params.id,{...req.body,signaturePages},req.file.buffer,req.ip);res.status(result.replayed?200:201).json(result);
      }catch(problem){fail(problem,res);}
    });
  }));
  router.get('/attachments/:id/pdf',handle(async(req,res)=>{const result=await readGanAttachment(db,req.user.id,req.params.id);await auditForm(db,result.actor,result.attachment.id,'GANAttachmentDownloaded','Downloaded '+result.attachment.kind+' v'+result.attachment.version+' IP: '+String(req.ip).slice(0,100),'GeneratedDocumentAttachment');send(res,result.pdf,result.attachment.pdf_sha256,result.attachment.kind+'-v'+result.attachment.version+'.pdf');}));
  router.post('/documents/:id/packages',handle(async(req,res)=>{const result=await saveGanPackage(db,req.user.id,req.params.id,req.body,req.ip);res.status(result.replayed?200:201).json(result);}));
  router.get('/documents/:id/packages',handle(async(req,res)=>res.json({packages:await listGanPackages(db,req.user.id,req.params.id)})));
  router.get('/packages/:id',handle(async(req,res)=>{const result=await readGanPackage(db,req.user.id,req.params.id);await auditForm(db,result.actor,result.package.id,'GANDraftPackagePreviewed','Previewed package r'+result.package.package_revision+' IP: '+String(req.ip).slice(0,100),'GeneratedDocument');res.json({package:result.package,manifest:result.manifest});}));
  router.get('/packages/:id/pdf',handle(async(req,res)=>{const result=await readGanPackage(db,req.user.id,req.params.id);await auditForm(db,result.actor,result.package.id,'GANDraftPackageDownloaded','Downloaded package r'+result.package.package_revision+' IP: '+String(req.ip).slice(0,100),'GeneratedDocument');send(res,result.pdf,result.package.pdf_sha256,'gan-package-'+result.package.id+'-draft.pdf');}));
  router.get('/packages/:id/parts/:partId',handle(async(req,res)=>{const result=await readGanPackagePart(db,req.user.id,req.params.id,req.params.partId);await auditForm(db,result.actor,result.package.id,'GANPackagePartDownloaded','Downloaded '+result.filename+' IP: '+String(req.ip).slice(0,100),'GeneratedDocument');send(res,result.pdf,result.sha256,result.filename);}));
  return router;
}
