import {Router} from 'express';
import {readGanOrganizationSettings,saveGanOrganizationSettings} from '../services/documents/ganOrganizationSettings.js';
import {readGanGranteeSettings,saveGanGranteeSettings,ganSettingsDirectory} from '../services/documents/ganGranteeSettings.js';
// Explicit staging factory only. No production startup import or mount.
export function createGanSettingsRouter(db,authenticate) {
  if(!db||typeof authenticate!=='function')throw new Error('GAN settings require a scoped database and authentication');
  const router=Router();router.use(authenticate);
  const handle=action=>async(req,res)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    try{await action(req,res);}catch(error){
      if(!error.status)console.error('GAN settings:',error.code||error.name);
      res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the award-contact operation'});
    }
  };
  router.get('/directory',handle(async(req,res)=>res.json(await ganSettingsDirectory(db,req.user.id))));
  router.get('/organizations/:id',handle(async(req,res)=>res.json(await readGanOrganizationSettings(db,req.user.id,req.params.id))));
  router.put('/organizations/:id',handle(async(req,res)=>res.json(await saveGanOrganizationSettings(db,req.user.id,req.params.id,req.body,req.ip))));
  router.get('/grantees/:id',handle(async(req,res)=>res.json(await readGanGranteeSettings(db,req.user.id,req.params.id))));
  router.put('/grantees/:id',handle(async(req,res)=>res.json(await saveGanGranteeSettings(db,req.user.id,req.params.id,req.body,req.ip))));
  return router;
}
