import {ehpAuditExport} from '../services/ehp/ehpAuditExport.js';
import {Router} from 'express';
import pool from '../db/connection.js';
import {authRequired} from '../middleware/auth.js';
import {applicationFormContext} from '../services/forms/applicationFormSave.js';
import {applicationForFormExport} from '../services/forms/formAuditExport.js';
export function createAuditPackageRouter(db=pool,authenticate=authRequired){
const router=Router();
// Audit Package export
router.post('/exportAuditPackage',authenticate,async(req,res)=>{
  try {
    const JSZip = (await import('jszip')).default;
    const { application_id } = req.body;
    if (!application_id) return res.status(400).json({ error: 'application_id required' });

    // Get application
    const appResult = await db.query(
      'SELECT * FROM applications WHERE id = $1', [application_id]
    );
    let application = appResult.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const formContext=await applicationFormContext(db,req.user.id,application_id,'export');
    application=applicationForFormExport(application,formContext);
    // Get related records
    const [budgets, reviews, fundingReqs, documents, auditLogs, reviewComments] = await Promise.all([
      db.query('SELECT * FROM application_budgets WHERE application_id = $1', [application_id]),
      db.query('SELECT * FROM application_reviews WHERE application_id = $1', [application_id]),
      db.query('SELECT * FROM funding_requests WHERE application_id = $1', [application_id]),
      db.query('SELECT * FROM documents WHERE application_id = $1', [application_id]),
      db.query("SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_date", [application_id]),
      db.query("SELECT * FROM review_comments WHERE entity_id = $1 ORDER BY created_date", [application_id]),
    ]);

    const ehp=await ehpAuditExport(db,application_id);
    // Build ZIP
    const zip = new JSZip();
    const folder = zip.folder(`audit_package_${application.application_number || application_id}`);

    // Application summary text
    const summary = [
      `AUDIT PACKAGE — ${application.application_number || application_id}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `APPLICATION DETAILS`,
      `Status: ${application.status}`,
      `Organization: ${application.organization_name}`,
      `Program: ${application.program_name} (${application.program_code})`,
      `Project: ${application.project_title}`,
      `Requested: $${application.requested_amount || 0}`,
      `Awarded: $${application.awarded_amount || 0}`,
      `Total Expended: $${application.total_expended || 0}`,
      `Performance: ${application.performance_start || 'N/A'} to ${application.performance_end || 'N/A'}`,
      `Submitted By: ${application.submitted_by}`,
      `Submitted At: ${application.submitted_at || 'N/A'}`,
      ``,
      `BUDGET (${budgets.rows.length} line items)`,
      ...budgets.rows.map(b => `  ${b.budget_category}: $${b.amount_requested} requested, $${b.amount_match} match — ${b.line_description}`),
      ``,
      `REVIEWS (${reviews.rows.length})`,
      ...reviews.rows.map(r => `  ${r.created_date?.toISOString?.().slice(0,10) || ''} — ${r.action} by ${r.reviewer_name} (Score: ${r.score || 'N/A'}) — ${r.notes || ''}`),
      ``,
      `FUNDING REQUESTS (${fundingReqs.rows.length})`,
      ...fundingReqs.rows.map(f => `  ${f.request_number} — $${f.amount_requested} — ${f.status}`),
      ``,
      `DOCUMENTS (${documents.rows.length})`,
      ...documents.rows.map(d => `  ${d.name} (${d.doc_type}) — ${d.review_status || 'Pending'} — ${d.file_url || 'No file'}`),
      ``,
      `REVIEW HISTORY (${reviewComments.rows.length} comments)`,
      ...reviewComments.rows.map(c => `  ${c.created_date?.toISOString?.().slice(0,10) || ''} — [${c.action}] ${c.reviewer_name}: ${c.comment}`),
      ``,
      `AUDIT LOG (${auditLogs.rows.length} entries)`,
      ...auditLogs.rows.map(l => `  ${l.created_date?.toISOString?.().slice(0,10) || ''} — ${l.action} by ${l.user_name}: ${l.description}`),
    ].join('\n');

    folder.file('audit_summary.txt', summary);
    folder.file('application.json', JSON.stringify(application, null, 2));
    if(formContext.version)folder.file('nofo_form_values.json',JSON.stringify({version:formContext.version.version,fields:formContext.fields},null,2));
    folder.file('ehp_decisions.json',JSON.stringify(ehp.decisions,null,2));
    folder.file('funding_request_line_items.json',JSON.stringify(ehp.lines,null,2));
    folder.file('budget_line_items.json', JSON.stringify(budgets.rows, null, 2));
    folder.file('reviews.json', JSON.stringify(reviews.rows, null, 2));
    folder.file('funding_requests.json', JSON.stringify(fundingReqs.rows, null, 2));
    folder.file('documents.json', JSON.stringify(documents.rows, null, 2));
    folder.file('review_history.json', JSON.stringify(reviewComments.rows, null, 2));
    folder.file('audit_log.json', JSON.stringify(auditLogs.rows, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename=audit_package_${application.application_number || application_id}.zip`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Audit package export error:', err);
    res.status(err.status||500).json({error:err.status?err.message:'Failed to generate audit package'});
  }
});

return router;
}
