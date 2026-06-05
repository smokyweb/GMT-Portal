import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authRouter from './routes/auth.js';
import entitiesRouter from './routes/entities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/entities', entitiesRouter);

// File upload endpoint
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const fileStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
});
const upload = multer({ storage: fileStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/api/files/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, originalName: req.file.originalname });
});

app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ''));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Audit Package export
app.post('/api/functions/exportAuditPackage', async (req, res) => {
  try {
    const JSZip = (await import('jszip')).default;
    const { application_id } = req.body;
    if (!application_id) return res.status(400).json({ error: 'application_id required' });

    // Get application
    const appResult = await (await import('./db/connection.js')).default.query(
      'SELECT * FROM applications WHERE id = $1', [application_id]
    );
    const application = appResult.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Get related records
    const pool = (await import('./db/connection.js')).default;
    const [budgets, reviews, fundingReqs, documents, auditLogs, reviewComments] = await Promise.all([
      pool.query('SELECT * FROM application_budgets WHERE application_id = $1', [application_id]),
      pool.query('SELECT * FROM application_reviews WHERE application_id = $1', [application_id]),
      pool.query('SELECT * FROM funding_requests WHERE application_id = $1', [application_id]),
      pool.query('SELECT * FROM documents WHERE application_id = $1', [application_id]),
      pool.query("SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_date", [application_id]),
      pool.query("SELECT * FROM review_comments WHERE entity_id = $1 ORDER BY created_date", [application_id]),
    ]);

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
    res.status(500).json({ error: 'Failed to generate audit package: ' + err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GMT Portal API running on http://localhost:${PORT}`);
});
