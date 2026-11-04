import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseObject,formFields,fieldIsVisible,fieldValue} from '../../../src/lib/forms/defaultForm.js';
import {accountError} from '../accountPolicy.js';
import {validateFormValues,validateBudget,ehpRequired,fileReference,valuesForAudience} from './valueValidation.js';
const uploadRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../uploads');
export function deriveEhp(definition,application,previous={},affectedCosts=false) {
  const context={application,values:parseObject(application.form_values)};
  const required=ehpRequired(definition,context)||affectedCosts;
  const unchanged=JSON.stringify(parseObject(application.ehp_screening_answers))===JSON.stringify(parseObject(previous.ehp_screening_answers))&&
    JSON.stringify(parseObject(application.form_values))===JSON.stringify(parseObject(previous.form_values));
  return {ehp_required:required,ehp_status:required?(unchanged&&previous.ehp_status==='Approved'?'Approved':'ScreeningRequired'):'NotRequired',
    ehp_approval_date:required&&unchanged&&previous.ehp_status==='Approved'?previous.ehp_approval_date:null};
}
export async function checkSubmission(db,definition,application,nofo,organization,verifyFile=existingUpload) {
  const context={application,organization,values:parseObject(application.form_values)},errors=validateFormValues(definition,context);
  const budget=(await db.query('SELECT * FROM application_budgets WHERE application_id=$1',[application.id])).rows;
  errors.push(...validateBudget(definition,budget,application));
  const projectsTable=(await db.query("SELECT to_regclass(current_schema()||'.projects') AS name")).rows[0]?.name;
  const projects=projectsTable?(await db.query('SELECT * FROM projects WHERE application_id=$1 AND is_active=true ORDER BY created_date,id',[application.id])).rows:[];
  if(projectsTable&&!projects.length)errors.push({sectionId:'budget',message:'Add at least one active Project before submitting.'});
  for(const [index,project] of projects.entries()) {
    if(!String(project.title||'').trim())errors.push({sectionId:'budget',message:`Project ${index+1} needs a title.`});
    if(!project.is_legacy_backfill&&!/^\d{5}$/.test(String(project.project_zip||'')))errors.push({sectionId:'budget',message:`Project ${index+1} needs a 5-digit ZIP.`});
  }
  const documents=(await db.query('SELECT * FROM documents WHERE application_id=$1',[application.id])).rows;
  const required=(definition.rules.requiredDocuments||nofo.required_documents||[]).filter(doc=>doc.mandatory).map(doc=>doc.name);
  if(ehpRequired(definition,context))required.push(definition.rules.ehpScreeningDocument);
  for(const name of new Set(required)) {
    const uploaded=documents.find(doc=>doc.name===name&&fileReference(doc.file_url));
    if(!uploaded||!await verifyFile(uploaded.file_url))errors.push({sectionId:'documents',message:'Upload required document: '+name});
  }
  for(const field of formFields(definition)) {
    if(field.type==='file'&&fieldIsVisible(field,definition,context)) {
      const value=fieldValue(field,context);
      if(value&&fileReference(value)&&!await verifyFile(typeof value==='string'?value:value.url))errors.push({fieldId:field.id,sectionId:field.sectionId,message:field.label+' upload is unavailable. Upload it again.'});
    }
  }
  if(errors.length)throw Object.assign(accountError(422,'Complete the required application fields before submitting'),{details:errors});
  return {valid:true,fields:valuesForAudience(definition,context,'reviewer')};
}
export async function existingUpload(url) {
  if(!fileReference(url))return false;
  const target=path.resolve(uploadRoot,path.basename(url));
  if(path.dirname(target)!==uploadRoot)return false;
  try {const stat=await fs.lstat(target);return stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0;}catch{return false;}
}
