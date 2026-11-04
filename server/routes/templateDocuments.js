import {Router} from 'express';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {generateTemplateFile,ensureTemplatePath,templateValueMap} from '../services/templateDocumentGeneration.js';

export function createTemplateDocumentsRouter(pool,authRequired,uploadsDir){
  const router=Router();
  router.post('/generate',authRequired,async(req,res)=>{
    try {
      if(!['admin','isc_admin','federal_admin','federal_officer','reviewer'].includes(req.user.role))return res.status(403).json({error:'Insufficient permissions'});
      const {templateId,applicationId}=req.body||{};
      const template=(await pool.query('SELECT * FROM document_templates WHERE id=$1 AND COALESCE(is_active,true)=true',[templateId])).rows[0];
      const application=(await pool.query('SELECT * FROM applications WHERE id=$1',[applicationId])).rows[0];
      if(!template||!application)return res.status(404).json({error:'Template or application not found'});
      if(template.template_use!=='Generated Document' && template.doc_type!=='Grant Award Notice')return res.status(400).json({error:'Only Generated Document templates can create drafts'});
      const nofo=(await pool.query('SELECT * FROM nofos WHERE id=$1',[application.nofo_id])).rows[0];
      const organization=(await pool.query('SELECT * FROM organizations WHERE id=$1',[application.organization_id])).rows[0]||{};
      const program=(await pool.query('SELECT * FROM grant_programs WHERE id=$1',[nofo?.program_id])).rows[0]||{};
      const grantee=(await pool.query('SELECT * FROM grantees WHERE id=$1',[organization.grantee_id||req.user.grantee_id])).rows[0]||{};
      const projects=(await pool.query('SELECT budget_category,line_description,amount_requested,amount_match FROM application_budgets WHERE application_id=$1 ORDER BY created_date',[application.id])).rows;
      const values=templateValueMap({application,nofo,organization,program,grantee,templateMappings:template.token_mappings||{},projects});
      const warnings=Object.entries(template.token_mappings||{}).filter(([,field])=>!values[field]).map(([token])=>token);
      let fileUrl='',fileName=template.file_name||'';
      if(template.file_url){
        const source=await ensureTemplatePath(uploadsDir,template.file_url);
        if(!/\.docx$/i.test(source))return res.status(400).json({error:'Generated Document templates require a DOCX file'});
        fileName=`${randomUUID()}-${path.basename(fileName||'draft.docx')}`;
        const target=path.join(uploadsDir,fileName);
        await generateTemplateFile({sourcePath:source,outputPath:target,values});
        fileUrl=`/api/files/${fileName}`;
      }
      const populatedBody=String(template.template_body||'').replace(/\{\{\s*([^}]+?)\s*\}\}/g,(_m,key)=>values[key.trim()]??'');
      const inserted=(await pool.query(`INSERT INTO generated_documents (template_id,template_name,doc_type,application_id,application_number,organization_id,organization_name,populated_body,file_url,file_name,sent_by,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Draft') RETURNING *`,[template.id,template.name,template.doc_type,application.id,application.application_number,application.organization_id,application.organization_name,populatedBody,fileUrl,fileName,req.user.email||req.user.full_name||''])).rows[0];
      res.json({id:inserted.id,file_url:fileUrl,file_name:fileName,populated_body:populatedBody,warnings,document:inserted});
    } catch(error) { console.error('Generate template draft:',error); res.status(500).json({error:error.message||'Unable to generate draft'}); }
  });
  return router;
}
