import {syncApplicationAward} from '../awards/awardApplicationSync.js';
import {legacyForm} from '../../../src/lib/forms/legacyForm.js';
import {submissionMetadata,notifyApplicationSubmission} from './applicationSubmission.js';
import {moneyCents} from './valueValidation.js';
import {randomUUID} from 'node:crypto';
import {defaultForm,formFields,parseObject} from '../../../src/lib/forms/defaultForm.js';
import {accountError} from '../accountPolicy.js';
import {transaction} from '../accountRepository.js';
import {formActor,formNofo,assertNofoAccess,assertApplicationAccess,auditForm} from './formAccess.js';
import {ensurePinnedForm} from './formVersions.js';
import {deriveEhp,checkSubmission} from './formSubmission.js';
function normalizedSubawardNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}
export async function normalizeApplicationInput(db, input, {id = null, previous = null} = {}) {
  const data = {...input};
  const prior = previous || (id ? (await db.query('SELECT * FROM applications WHERE id::text=$1',[id])).rows[0] : null);
  const organizationId = data.organization_id ?? prior?.organization_id;
  const nofoId = data.nofo_id ?? prior?.nofo_id;
  const subawardNumber = data.grant_number === undefined ? normalizedSubawardNumber(prior?.grant_number) : normalizedSubawardNumber(data.grant_number);
  if (data.grant_number !== undefined) data.grant_number = subawardNumber;
  if (subawardNumber && (!organizationId || !nofoId)) throw accountError(400,'A Subaward # requires both an organization and a NOFO');
  if (nofoId) {
    const nofo = (await db.query('SELECT id,program_code,program_name,title FROM nofos WHERE id::text=$1',[nofoId])).rows[0];
    if (!nofo) throw accountError(400,'Select an existing NOFO');
    data.nofo_id = nofo.id; data.nofo_title = nofo.title;
    data.program_code = nofo.program_code; data.program_name = nofo.program_name;
  }
  const priorNumber = normalizedSubawardNumber(prior?.grant_number);
  const numberChanged = subawardNumber && (!prior || priorNumber?.toLowerCase() !== subawardNumber.toLowerCase());
  if (numberChanged) {
    const duplicate = (await db.query("SELECT a.id FROM applications a JOIN organizations o ON o.id::text=a.organization_id LEFT JOIN grantees g ON upper(g.state_code)=upper(o.state) WHERE a.id::text <> COALESCE($1,'') AND COALESCE(g.id::text,upper(o.state),'UNKNOWN')=(SELECT COALESCE(g2.id::text,upper(o2.state),'UNKNOWN') FROM organizations o2 LEFT JOIN grantees g2 ON upper(g2.state_code)=upper(o2.state) WHERE o2.id::text=$2) AND lower(btrim(a.grant_number))=lower(btrim($3)) LIMIT 1",[id,organizationId,subawardNumber])).rows[0];
    if (duplicate) throw accountError(409,'That Subaward # is already in use for this Grantee');
  }
  return data;
}
const userFields=new Set(['nofo_id','nofo_title','organization_id','organization_name','submitted_by','program_code','program_name','grant_number','status','requested_amount','match_amount','version','performance_start','performance_end','ehp_required','ehp_screening_answers','ehp_status','ehp_notes','form_values','form_version_id',
  ...['SHSP','EMPG','SLCGP','NSGP','EOC'].flatMap(program_code=>formFields(defaultForm({program_code})).filter(field=>field.source==='application').map(field=>field.key))]);
async function organizationFor(db,id) {
  const organization=(await db.query('SELECT * FROM organizations WHERE id::text=$1',[id])).rows[0];
  if(!organization)throw accountError(400,'Select an existing organization');
  return organization;
}
function requestData(input,actor) {
  if(!input||Array.isArray(input)||typeof input!=='object')throw accountError(400,'Provide application fields');
  const data={...input};
  for(const key of ['id','created_date','updated_date'])delete data[key];
  if(Object.keys(data).some(key=>!/^[_a-z][_a-z0-9]*$/i.test(key)))throw accountError(400,'Invalid application field');
  if(actor.role==='user'&&Object.keys(data).some(key=>!userFields.has(key)))throw accountError(403,'This account cannot change administrative application fields');
  if(data.form_values!==undefined&&(!data.form_values||typeof data.form_values!=='object'||Array.isArray(data.form_values)||JSON.stringify(data.form_values).length>1000000))throw accountError(400,'Custom values must be an object under 1 MB');
  for(const field of ['SHSP','EMPG','SLCGP','NSGP','EOC'].flatMap(program_code=>formFields(defaultForm({program_code})))) {
    if(field.source==='application'&&field.type==='currency'&&data[field.key]!==undefined&&moneyCents(data[field.key])===null)throw accountError(400,field.label+' needs a nonnegative amount with at most two decimals');
  }
  return data;
}
export async function saveFormApplication(pool,actorId,id,input,verifyFile) {
  return transaction(pool,async db=>{
    const actor=await formActor(db,actorId),data=requestData(input,actor);
    if(!['isc_admin','admin'].includes(actor.role)&&data.awarded_amount!==undefined)throw accountError(403,'An administrator must set the award amount');
    let previous=id?(await db.query('SELECT * FROM applications WHERE id::text=$1',[id])).rows[0]:null;
    if(id&&!previous)throw accountError(404,'Application not found');
    const nofoId=data.nofo_id||previous?.nofo_id,nofo=nofoId?await formNofo(db,nofoId,true):null;
    if(id) {
      previous=(await db.query('SELECT * FROM applications WHERE id::text=$1 FOR UPDATE',[id])).rows[0];
      if(previous?.form_version_id&&data.nofo_id&&data.nofo_id!==previous.nofo_id)throw accountError(409,'A started application keeps its original NOFO and form version');
      if(previous?.nofo_id&&nofo?.id!==previous.nofo_id)throw accountError(409,'The application NOFO changed. Reload before saving.');
    }
    if(previous)assertApplicationAccess(actor,previous,await organizationFor(db,previous.organization_id),true);
    const organization=await organizationFor(db,data.organization_id||previous?.organization_id||actor.organization_id);
    const proposed={...previous,...data,id:id||randomUUID(),organization_id:organization.id,status:previous?.status||'Draft'};
    assertApplicationAccess(actor,proposed,organization,true);
    if(actor.role==='user'&&data.status&&!['Draft','Submitted'].includes(data.status))throw accountError(403,'Use the review workflow for administrative status changes');
    if(['ehp_status','ehp_approval_date','ehp_review_revision','ehp_manual_required'].some(key=>data[key]!==undefined))throw accountError(403,'Use the EHP review panel to record or reopen EHP approval');
    if(actor.role==='user'&&!nofo)throw accountError(400,'Select a NOFO before starting an application');
    if(nofo)assertNofoAccess(actor,nofo,organization,!previous);
    if(data.form_version_id&&data.form_version_id!==previous?.form_version_id)throw accountError(409,'Application form versions are assigned by the server');
    delete data.form_version_id;
    let version;
    if(previous?.form_version_id) {
      version=(await db.query('SELECT * FROM nofo_form_versions WHERE id=$1 AND nofo_id::text=$2',[previous.form_version_id,previous.nofo_id])).rows[0];
      if(!version)throw accountError(409,'The application form version is unavailable');
    } else if(nofo)version=await ensurePinnedForm(db,nofo,actor);
    if(!version&&data.form_values&&Object.keys(data.form_values).length)throw accountError(400,'Select a NOFO before entering custom form values');
    Object.assign(data,{organization_id:organization.id,organization_name:organization.name});
    if(nofo)Object.assign(data,{nofo_id:nofo.id,nofo_title:nofo.title,program_code:nofo.program_code,program_name:nofo.program_name});
    Object.assign(data,await normalizeApplicationInput(db,data,{id,previous}));
    if(!id)Object.assign(data,{submitted_by:actor.email,created_by:actor.email,status:data.status||'Draft'});
    else if(actor.role==='user')data.submitted_by=previous.submitted_by;
    {
      if(version)data.form_version_id=version.id;
      const application={...previous,...data,id:proposed.id};
      const affectedCosts=previous&&Object.hasOwn(previous,'ehp_review_revision')&&(await db.query('SELECT id FROM application_budgets WHERE application_id=$1 AND ehp_affected=true LIMIT 1',[id])).rows.length>0;
      const ehp=deriveEhp(version?.definition||legacyForm(nofo||{program_code:application.program_code}),application,previous||{},Boolean(affectedCosts||previous?.ehp_manual_required));
      if(previous&&Object.hasOwn(previous,'ehp_review_revision')&&(ehp.ehp_status!==previous.ehp_status||JSON.stringify(parseObject(application.ehp_screening_answers))!==JSON.stringify(parseObject(previous.ehp_screening_answers))))data.ehp_review_revision=previous.ehp_review_revision+1;
      Object.assign(data,ehp);
      if(version&&data.status==='Submitted')await checkSubmission(db,version.definition,{...application,...ehp},nofo,organization,verifyFile);
    }
    if(data.status==='Submitted')Object.assign(data,await submissionMetadata(db,previous||{}));
    const columns=new Set((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='applications'")).rows.map(row=>row.column_name));
    if(Object.keys(data).some(key=>!columns.has(key)))throw accountError(400,'Unknown application field');
    const keys=Object.keys(data),values=keys.map(key=>data[key]!==null&&typeof data[key]==='object'?JSON.stringify(data[key]):data[key]);
    let saved;
    if(id)saved=(await db.query('UPDATE applications SET '+keys.map((key,index)=>key+'=$'+(index+2)).join(',')+',updated_date=NOW() WHERE id=$1 RETURNING *',[id,...values])).rows[0];
    else saved=(await db.query('INSERT INTO applications(id,'+keys.join(',')+') VALUES($1,'+keys.map((_,index)=>'$'+(index+2)).join(',')+') RETURNING *',[proposed.id,...values])).rows[0];
    if(data.status==='Submitted'&&previous?.status!=='Submitted')await notifyApplicationSubmission(db,saved,organization);
    if(version&&(!previous?.form_version_id||data.status==='Submitted'))await auditForm(db,actor,saved.id,data.status==='Submitted'?'ApplicationFormSubmitted':'ApplicationFormPinned','Application uses form version '+version.version,'Application');
    saved=await syncApplicationAward(db,saved,previous,actor);
    return saved;
  });
}
export async function applicationFormContext(db,actorId,id,audience='reviewer') {
  const actor=await formActor(db,actorId),application=(await db.query('SELECT * FROM applications WHERE id::text=$1',[id])).rows[0];
  if(!application)throw accountError(404,'Application not found');
  const organization=await organizationFor(db,application.organization_id);
  assertApplicationAccess(actor,application,organization);
  if(!application.form_version_id)return {version:null,fields:[],values:parseObject(application.form_values)};
  const version=(await db.query('SELECT * FROM nofo_form_versions WHERE id=$1',[application.form_version_id])).rows[0];
  if(!version)throw accountError(409,'The application form version is unavailable');
  const {valuesForAudience}=await import('./valueValidation.js');
  const fields=valuesForAudience(version.definition,{application,organization,values:parseObject(application.form_values)},audience);
  return {version,fields,values:audience==='edit'?parseObject(application.form_values):Object.fromEntries(fields.filter(field=>field.id.startsWith('cf_')).map(field=>[field.id,field.value]))};
}
