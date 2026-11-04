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
const upload = multer({ storage: fileStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/api/files/${req.file.filename}`;
  const metadata=await inspectTemplateFile(req.file.path,req.file.originalname).catch(()=>({tokens:[]}));
  res.json({ url, filename: req.file.filename, originalName: req.file.originalname, ...metadata });
});

  await pool.query("ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_use TEXT, ADD COLUMN IF NOT EXISTS token_mappings JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_status_check, ADD CONSTRAINT generated_documents_status_check CHECK (status IN ('Draft','Sent','Reviewed','Signed','Rejected'))");
app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ''));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/functions',createAuditPackageRouter());

// ── Start ─────────────────────────────────────────────────────
// Keep existing installations compatible when the server is upgraded without
// rerunning the full schema initializer.
try {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ');
  await pool.query('ALTER TABLE grantees ADD COLUMN IF NOT EXISTS legacy_fields_enabled BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS legacy_system_name TEXT');
  await pool.query('ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legacy_spars_id TEXT, ADD COLUMN IF NOT EXISTS vendor_number TEXT, ADD COLUMN IF NOT EXISTS duns TEXT, ADD COLUMN IF NOT EXISTS region TEXT, ADD COLUMN IF NOT EXISTS nonprofit_category TEXT, ADD COLUMN IF NOT EXISTS address_line_2 TEXT, ADD COLUMN IF NOT EXISTS primary_contact_user_id TEXT');
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check, ADD CONSTRAINT organizations_type_check CHECK (type IN ('County','Municipality','Nonprofit','Tribe','Local Jurisdiction','Local Jurisdiction State Agency','State Agency','Federal Agency','University','Other'))");
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_zip_format_check, ADD CONSTRAINT organizations_zip_format_check CHECK (zip IS NULL OR zip='' OR zip ~ '^[0-9]{5}(-[0-9]{4})?$')");
  await pool.query("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_state_format_check, ADD CONSTRAINT organizations_state_format_check CHECK (state IS NULL OR state='' OR state ~ '^[A-Z]{2}$')");
  await pool.query('ALTER TABLE organizations ALTER COLUMN ein TYPE TEXT USING ein::text');
  await pool.query('ALTER TABLE organizations ALTER COLUMN sam_uei TYPE TEXT USING sam_uei::text');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS organizations_legacy_spars_id_unique ON organizations (legacy_spars_id) WHERE legacy_spars_id IS NOT NULL AND btrim(legacy_spars_id) <> \'\'');
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
  app.listen(PORT, () => {
    console.log(`GMT Portal API running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('Database compatibility migration failed:', err.message);
  process.exit(1);
}
