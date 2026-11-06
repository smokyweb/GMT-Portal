import {configureGanRuntime,migrateGanRuntime} from './services/documents/ganRuntime.js';
import {authRequired} from './middleware/auth.js';
import {createAwardDetailsRouter,createAwardNofoEntityRouter} from './routes/awardDetails.js';
import {migrateAwards} from './services/awards/awardMigration.js';
import {createEhpRouter} from './routes/ehp.js';
import {createFundingRequestRouter,createFundingEntityRouter} from './routes/fundingRequests.js';
import {migrateEhp} from './services/ehp/ehpMigration.js';
import {createAuditPackageRouter} from './routes/auditPackage.js';
import {createNofoFormsRouter,createFormApplicationRouter} from './routes/nofoForms.js';
import {migrateNofoForms} from './services/forms/formMigration.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pool from './db/connection.js';
import authRouter from './routes/auth.js';
import {inspectTemplateFile} from './services/templateInspection.js';
import entitiesRouter from './routes/entities.js';
import accountRouter from './routes/accountAccess.js';
import { migrateAccountAccess } from './services/accountMigration.js';
import { clearInvalidPrimaryContacts } from './services/organizationPolicy.js';
import {migrateNofoFields} from './services/nofoMigration.js';
import {createAwardNoticeRouter} from './routes/awardNotices.js';
import {migrateAwardNotices} from './services/documents/awardNoticeMigration.js';
import {createTemplateDocumentsRouter} from './routes/templateDocuments.js';
import {migrateTemplateDrafts} from './services/templateDraftMigration.js';
import {migrateProjects} from './services/projectMigration.js';
import {createSparsImportRouter} from './routes/sparsImport.js';
import {assertFileAccess} from './services/fileAccess.js';

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
app.use('/api/accounts', accountRouter);
app.use('/api/awards',createAwardDetailsRouter());
app.use('/api/award-notices',createAwardNoticeRouter(pool,authRequired));
app.use('/api/imports/spars',createSparsImportRouter(pool,authRequired));
app.use('/api/entities',createAwardNofoEntityRouter());
app.use('/api/forms',createNofoFormsRouter());
app.use('/api/ehp',createEhpRouter());
app.use('/api/funding-requests',createFundingRequestRouter());
app.use('/api/entities',createFundingEntityRouter());
app.use('/api/entities',createFormApplicationRouter());
configureGanRuntime(app,pool,authRequired);
app.use('/api/template-documents',createTemplateDocumentsRouter(pool,authRequired,path.join(__dirname,'uploads')));
app.use('/api/entities', entitiesRouter);

// File upload endpoint
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const fileStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
});
const allowedUploadTypes=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg']);
const upload = multer({ storage: fileStorage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req,file,cb) => {
  if(allowedUploadTypes.has(file.mimetype))return cb(null,true);
  return cb(Object.assign(new Error('File type not supported. Use PDF, Word, Excel, PNG, or JPEG.'),{status:415}));
} });

app.post('/api/upload', authRequired, (req,res,next)=>upload.single('file')(req,res,error=>{
  if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:(error.status||400)).json({error:error.code==='LIMIT_FILE_SIZE'?'File exceeds the 25 MB limit.':error.message});
  next();
}), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/api/files/${req.file.filename}`;
  const metadata=await inspectTemplateFile(req.file.path,req.file.originalname).catch(()=>({tokens:[]}));
  res.json({ url, filename: req.file.filename, originalName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, ...metadata });
});

  await pool.query("ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_use TEXT, ADD COLUMN IF NOT EXISTS token_mappings JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_status_check, ADD CONSTRAINT generated_documents_status_check CHECK (status IN ('Draft','Sent','Reviewed','Signed','Rejected'))");
app.get('/api/files/:filename', authRequired, async (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ''));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  try {
    await assertFileAccess(pool, req.user, req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ''));
    res.sendFile(filePath);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to authorize file access' });
  }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/functions',createAuditPackageRouter());

// ── Start ─────────────────────────────────────────────────────
// Keep existing installations compatible when the server is upgraded without
// rerunning the full schema initializer.
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS user_organizations (user_id TEXT NOT NULL, organization_id TEXT NOT NULL, created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,organization_id))`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_user_organizations_org ON user_organizations(organization_id)');
  await pool.query(`INSERT INTO user_organizations(user_id,organization_id) SELECT id::text,organization_id::text FROM users WHERE organization_id IS NOT NULL ON CONFLICT(user_id,organization_id) DO NOTHING`);
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ');
  await pool.query('ALTER TABLE grantees ADD COLUMN IF NOT EXISTS legacy_fields_enabled BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS legacy_system_name TEXT');
  await pool.query('ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legacy_spars_id TEXT, ADD COLUMN IF NOT EXISTS vendor_number TEXT, ADD COLUMN IF NOT EXISTS duns TEXT, ADD COLUMN IF NOT EXISTS region TEXT, ADD COLUMN IF NOT EXISTS nonprofit_category TEXT, ADD COLUMN IF NOT EXISTS address_line_2 TEXT, ADD COLUMN IF NOT EXISTS primary_contact_user_id TEXT');
  await pool.query('ALTER TABLE applications ADD COLUMN IF NOT EXISTS poc_user_id TEXT, ADD COLUMN IF NOT EXISTS poc_first_name TEXT, ADD COLUMN IF NOT EXISTS poc_last_name TEXT, ADD COLUMN IF NOT EXISTS poc_title TEXT, ADD COLUMN IF NOT EXISTS poc_email TEXT, ADD COLUMN IF NOT EXISTS poc_phone TEXT');
  await pool.query('ALTER TABLE application_budgets ADD COLUMN IF NOT EXISTS poete_category TEXT, ADD COLUMN IF NOT EXISTS quantity NUMERIC, ADD COLUMN IF NOT EXISTS unit_cost NUMERIC, ADD COLUMN IF NOT EXISTS legacy_budget_line_id TEXT');
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS application_budgets_legacy_line_id_unique ON application_budgets (legacy_budget_line_id) WHERE legacy_budget_line_id IS NOT NULL AND btrim(legacy_budget_line_id) <> ''");
  await pool.query("ALTER TABLE funding_requests ADD COLUMN IF NOT EXISTS legacy_reimbursement_id TEXT, ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS payment_method TEXT, ADD COLUMN IF NOT EXISTS amount_paid NUMERIC");
  await pool.query("ALTER TABLE funding_requests DROP CONSTRAINT IF EXISTS funding_requests_payment_method_check, ADD CONSTRAINT funding_requests_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('EFT','Check','Multiple Payables'))");
  await pool.query("ALTER TABLE funding_requests DROP CONSTRAINT IF EXISTS funding_requests_amount_paid_check, ADD CONSTRAINT funding_requests_amount_paid_check CHECK (amount_paid IS NULL OR amount_paid >= 0)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS funding_requests_legacy_reimbursement_id_unique ON funding_requests (legacy_reimbursement_id) WHERE legacy_reimbursement_id IS NOT NULL AND btrim(legacy_reimbursement_id) <> ''");
  await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT, ADD COLUMN IF NOT EXISTS file_size BIGINT');
  await pool.query('ALTER TABLE compliance_flags ADD COLUMN IF NOT EXISTS issue_type TEXT, ADD COLUMN IF NOT EXISTS issue_key TEXT, ADD COLUMN IF NOT EXISTS issue_metadata JSONB, ADD COLUMN IF NOT EXISTS resolution_reason TEXT, ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ');
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS compliance_flags_open_issue_unique ON compliance_flags (application_id, issue_type) WHERE is_resolved=false AND issue_type IS NOT NULL AND btrim(issue_type)<>''");
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check, ADD CONSTRAINT organizations_type_check CHECK (type IN ('County','Municipality','Nonprofit','Tribe','Local Jurisdiction','Local Jurisdiction State Agency','State Agency','Federal Agency','University','Other'))");
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_zip_format_check, ADD CONSTRAINT organizations_zip_format_check CHECK (zip IS NULL OR zip='' OR zip ~ '^[0-9]{5}(-[0-9]{4})?$')");
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_state_format_check, ADD CONSTRAINT organizations_state_format_check CHECK (state IS NULL OR state='' OR state ~ '^[A-Z]{2}$')");
  await pool.query('ALTER TABLE organizations ALTER COLUMN ein TYPE TEXT USING ein::text');
  await pool.query('ALTER TABLE organizations ALTER COLUMN sam_uei TYPE TEXT USING sam_uei::text');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS organizations_legacy_spars_id_unique ON organizations (legacy_spars_id) WHERE legacy_spars_id IS NOT NULL AND btrim(legacy_spars_id) <> \'\'');
  await pool.query('DROP INDEX IF EXISTS organizations_vendor_number_unique');
  await pool.query("CREATE INDEX IF NOT EXISTS organizations_vendor_number_idx ON organizations (vendor_number) WHERE vendor_number IS NOT NULL AND btrim(vendor_number) <> ''");
  await pool.query("CREATE OR REPLACE FUNCTION clear_invalid_primary_contact() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN UPDATE organizations o SET primary_contact_user_id=NULL,updated_date=NOW() WHERE o.primary_contact_user_id=OLD.id::text AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=OLD.id AND u.organization_id=o.id::text AND COALESCE(u.active_status,'active') NOT IN ('inactive','deactivated','invited')); IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END; $fn$");
  await pool.query('DROP TRIGGER IF EXISTS users_clear_invalid_primary_contact ON users');
  await pool.query('CREATE TRIGGER users_clear_invalid_primary_contact AFTER UPDATE OF organization_id,active_status OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION clear_invalid_primary_contact()');
  await clearInvalidPrimaryContacts(pool);
  await migrateAccountAccess(pool);
  await migrateAwards(pool);
  await migrateNofoFields(pool);
  await migrateNofoForms(pool);
  await migrateEhp(pool);
  await migrateGanRuntime(pool);
  await migrateAwardNotices(pool);
  await migrateTemplateDrafts(pool);
  await migrateProjects(pool);
  app.listen(PORT, () => {
    console.log(`GMT Portal API running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('Database compatibility migration failed:', err.message);
  process.exit(1);
}
