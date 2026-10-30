import {readProgramForm,readNofoProgramDefaults} from '../services/forms/programFormDefaults.js';
import {saveProgramForm} from '../services/forms/programFormVersions.js';
import {Router} from 'express';
import pool from '../db/connection.js';
import {authRequired} from '../middleware/auth.js';
import {readNofoForm,saveNofoForm} from '../services/forms/formVersions.js';
import {saveFormApplication,applicationFormContext} from '../services/forms/applicationFormSave.js';
const handle=action=>async(req,res)=>{
  try {await action(req,res);}
  catch(error) {if(!error.status)console.error('NOFO form operation failed:',error.message);res.status(error.status||500).json({error:error.status?error.message:'Unable to complete the application form operation',...(error.details?{details:error.details}:{})});}
};
export function createNofoFormsRouter(db=pool,authenticate=authRequired) {
  const router=Router();router.use(authenticate);
  router.get('/programs/:id',handle(async(req,res)=>res.json(await readProgramForm(db,req.user.id,req.params.id,req.query.scope_state))));
  router.put('/programs/:id',handle(async(req,res)=>res.json(await saveProgramForm(db,req.user.id,req.params.id,req.body))));
  router.get('/nofos/:id/program-defaults',handle(async(req,res)=>res.json(await readNofoProgramDefaults(db,req.user.id,req.params.id))));
  router.get('/nofos/:id',handle(async(req,res)=>res.json(await readNofoForm(db,req.user.id,req.params.id))));
  router.put('/nofos/:id',handle(async(req,res)=>res.json(await saveNofoForm(db,req.user.id,req.params.id,req.body))));
  router.get('/applications/:id',handle(async(req,res)=>res.json(await applicationFormContext(db,req.user.id,req.params.id,['export','edit'].includes(req.query.audience)?req.query.audience:'reviewer'))));
  return router;
}
export function createFormApplicationRouter(db=pool,authenticate=authRequired,verifyFile=undefined) {
  const router=Router();
  router.post('/Application',authenticate,handle(async(req,res)=>res.status(201).json(await saveFormApplication(db,req.user.id,null,req.body,verifyFile))));
  router.put('/Application/:id',authenticate,handle(async(req,res)=>res.json(await saveFormApplication(db,req.user.id,req.params.id,req.body,verifyFile))));
  return router;
}
