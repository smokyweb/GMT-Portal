import {Router} from 'express';
import multer from 'multer';
import {accountError} from '../services/accountPolicy.js';
import {auditForm} from '../services/forms/formAccess.js';
import {ganWorkflowAccess,assertGanRecipient} from '../services/documents/ganWorkflowAccess.js';
import {currentGanReturnIssue} from '../services/documents/ganReturnAccess.js';
import {saveGanReturnUpload} from '../services/documents/ganReturnUploads.js';
import {readGanReturnUpload,readGanReturnSubmission} from '../services/documents/ganReturnRead.js';
import {MAX_GAN_ATTACHMENT_BYTES} from '../services/documents/pdf/ganAttachmentPdf.js';
export function createGanReturnsRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw Error('Signed GAN returns require scoped storage and authentication');
  const router=Router();router.use(authenticate);router.use((_req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});next();});
  const fail=(error,res)=>{if(!error.status)console.error('GAN returns:',error.code||error.name);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the signed-return operation'});};
  const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){fail(error,res);}};
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_GAN_ATTACHMENT_BYTES,files:1,fields:4,parts:6,fieldSize:4096}});
  router.post('/documents/:id/return-uploads',handle(async(req,res)=>{
    const access=await ganWorkflowAccess(db,req.user.id,req.params.id),{issue}=await currentGanReturnIssue(db,access);assertGanRecipient(access,issue);
    if(!issue.manifest.allowed_methods.includes('upload'))throw accountError(403,'This issued template allows electronic signing only');
    upload.single('file')(req,res,async error=>{
      try{
        if(error)throw accountError(error.code==='LIMIT_FILE_SIZE'?413:400,error.code==='LIMIT_FILE_SIZE'?'Choose a signed PDF no larger than 10 MB':'Upload one signed PDF with the requested fields');
        if(!req.file)throw accountError(400,'Choose a signed PDF');let sourcePages;try{sourcePages=JSON.parse(req.body.sourcePages||'[]');}catch{throw accountError(400,'List the original page numbers included');}
        const result=await saveGanReturnUpload(db,req.user.id,req.params.id,{...req.body,expectedRevision:Number(req.body.expectedRevision),sourcePages},req.file.buffer,req.file.originalname,req.ip);
        res.status(result.replayed?200:201).json(result);
      }catch(problem){fail(problem,res);}
    });
  }));
  const send=(req,res,result,action)=>{
    return auditForm(db,result.actor,result.document.id,action,'Issue '+result.issue.id+'; SHA-256 '+result.pdf_sha256+'; observed IP: '+String(req.ip).slice(0,100),'GeneratedDocument').then(()=>{
      res.set({'Content-Type':'application/pdf','Content-Disposition':(req.query.download==='1'?'attachment':'inline')+'; filename="'+result.filename+'"','X-GMT-Document-SHA256':result.pdf_sha256});res.send(result.pdf);
    });
  };
  router.get('/return-uploads/:id/pdf',handle(async(req,res)=>send(req,res,await readGanReturnUpload(db,req.user.id,req.params.id),req.query.download==='1'?'GANSignedOriginalDownloaded':'GANSignedOriginalPreviewed')));
  router.get('/return-submissions/:id/pdf',handle(async(req,res)=>send(req,res,await readGanReturnSubmission(db,req.user.id,req.params.id),req.query.download==='1'?'GANSignedSubmissionDownloaded':'GANSignedSubmissionPreviewed')));
  return router;
}
