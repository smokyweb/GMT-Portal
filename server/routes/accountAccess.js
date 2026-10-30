import { Router } from 'express';
import pool from '../db/connection.js';
import { authRequired } from '../middleware/auth.js';
import { sendAccountAccessEmail } from '../email.js';
import { createAccountService } from '../services/accountService.js';
import { accountActor, listManagedAccounts } from '../services/accountRepository.js';
import { publicAccount } from '../services/accountPolicy.js';
import { updateManagedAccount, bulkUpdateManagedAccounts } from '../services/accountUpdates.js';
import { previewAccountInvites, commitAccountInvites } from '../services/accountImport.js';
export function createAccountRouter(db=pool, sendLink=sendAccountAccessEmail, authenticate=authRequired) {
  const router=Router();
  const service=createAccountService(db,sendLink);
  const handle=action=>async(req,res)=>{
    try {res.json(await action(req,res));}
    catch(error) {
      if(!error.status) console.error('Account access request failed:',error.code||error.name);
      res.status(error.status||503).json({error:error.status?error.message:'Unable to complete account access. Please try again.'});
    }
  };
  router.get('/context',authenticate,handle(async req=>publicAccount(await accountActor(db,req.user.id))));
  router.get('/',authenticate,handle(async req=>{
    const actor=await accountActor(db,req.user.id);
    return (await listManagedAccounts(db,actor)).map(publicAccount);
  }));
  router.put('/:id',authenticate,handle(req=>updateManagedAccount(db,req.user.id,req.params.id,req.body,req.ip)));
  router.post('/bulk-update',authenticate,handle(req=>bulkUpdateManagedAccounts(db,req.user.id,req.body.ids,req.body.changes,req.ip)));
  router.post('/import-preview',authenticate,handle(req=>previewAccountInvites(db,req.user.id,req.body.rows)));
  router.post('/import-commit',authenticate,handle(req=>commitAccountInvites(db,sendLink,req.user.id,req.body.rows,req.body.fingerprint,req.ip)));
  router.post('/invite',authenticate,handle(req=>service.invite(req.user.id,req.body,req.ip)));
  router.post('/:id/reset',authenticate,handle(req=>service.reset(req.user.id,req.params.id,req.body,req.ip)));
  router.post('/:id/resend-invite',authenticate,handle(req=>service.reset(req.user.id,req.params.id,{revoke_sessions:false},req.ip,'invite')));
  router.post('/complete',handle(req=>service.complete(req.body.token,req.body.password,req.ip)));
  router.post('/change-password',authenticate,handle(req=>service.changePassword(req.user.id,req.body.password,req.ip)));
  return router;
}
export default createAccountRouter();
