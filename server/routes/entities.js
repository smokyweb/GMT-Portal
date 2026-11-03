import {createProgramFormEntityAccess} from '../middleware/programFormEntityAccess.js';
import {createApplicationBudgetAccess} from '../middleware/applicationBudgetAccess.js';
import {createNofoFormEntityAccess} from '../middleware/nofoFormEntityAccess.js';
import { Router } from 'express';
import pool from '../db/connection.js';
import { authRequired } from '../middleware/auth.js';
import { guardUserMutation } from '../middleware/userEntityAccess.js';
import { updateManagedAccount } from '../services/accountUpdates.js';
import { legacyContext,stripLegacyFields,stripNofoLegacyFields,assertLegacyGranteeMutation,assertLegacyOrganizationMutation,assertLegacyNofoMutation } from '../services/legacyFields.js';
import { normalizeOrganizationInput } from '../services/organizationPolicy.js';
import { normalizeApplicationInput } from '../services/forms/applicationFormSave.js';
import { normalizeNofoInput } from '../services/nofoPolicy.js';

const router = Router();
router.use('/:entity', authRequired);
router.use('/:entity/:id?', guardUserMutation);
router.use('/:entity/:id?',createApplicationBudgetAccess(),createNofoFormEntityAccess(),createProgramFormEntityAccess());

// ── Entity name → Postgres table mapping ──────────────────────
const TABLE_MAP = {
  Application:             'applications',
  ApplicationBudget:       'application_budgets',
  ApplicationReview:       'application_reviews',
  AppSettings:             'app_settings',
  AuditLog:                'audit_logs',
  BudgetAmendment:         'budget_amendments',
  Credit:                  'credits',
  CreditApplication:       'credit_applications',
  Task:                    'tasks',
  ComplianceFlag:          'compliance_flags',
  Document:                'documents',
  DocumentTemplate:        'document_templates',
  FundingRequest:          'funding_requests',
  FundingRequestLineItem:  'funding_request_line_items',
  GeneratedDocument:       'generated_documents',
  Grantee:                 'grantees',
  GrantProgram:            'grant_programs',
  Message:                 'messages',
  Milestone:               'milestones',
  Nofo:                    'nofos',
  Notification:            'notifications',
  Organization:            'organizations',
  ProgressReport:          'progress_reports',
  ReportSchedule:          'report_schedules',
  SavedReport:             'saved_reports',
  TemplateVersion:         'template_versions',
  User:                    'users',
  WorkflowRule:            'workflow_rules',
  ReviewComment:           'review_comments',
};

function resolveTable(entity) {
  const table = TABLE_MAP[entity];
  if (!table) return null;
  return table;
}
async function organizationContext(req){return legacyContext(pool,req.user,req.query.grantee_id||null)}
function sanitizeOrganizationRows(rows,context){return rows.map(row=>stripLegacyFields(row,context.enabled))}
function sanitizeNofoRows(rows,context){return rows.map(row=>stripNofoLegacyFields(row,context.enabled))}

// Parse Base44-style sort string: "-created_date" → "created_date DESC"
function parseSort(sortStr) {
  if (!sortStr) return 'created_date DESC';
  const desc = sortStr.startsWith('-');
  const col = desc ? sortStr.slice(1) : sortStr;
  // Whitelist: only allow alphanumeric + underscore column names
  if (!/^[a-z_][a-z0-9_]*$/i.test(col)) return 'created_date DESC';
  return `${col} ${desc ? 'DESC' : 'ASC'}`;
}

// ── LIST  GET /api/entities/:entity ───────────────────────────
// Query params: sort (e.g. "-created_date"), limit (number)
router.get('/:entity', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const sort = parseSort(req.query.sort);
  const limit = Math.min(parseInt(req.query.limit) || 500, 5000);

  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} ORDER BY ${sort} LIMIT $1`,
      [limit]
    );
    if(table==='users')rows.forEach(r=>delete r.password_hash);
    if(table==='organizations')return res.json(sanitizeOrganizationRows(rows,await organizationContext(req)));
    if(table==='nofos')return res.json(sanitizeNofoRows(rows,await organizationContext(req)));
    res.json(rows);
  } catch (err) {
    console.error(`List ${table}:`, err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── FILTER  POST /api/entities/:entity/filter ─────────────────
// Body: { filter: {field: value, ...}, sort: "-col", limit: 100 }
router.post('/:entity/filter', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const { filter = {}, sort, limit: rawLimit } = req.body;
  const orderBy = parseSort(sort);
  const limit = Math.min(parseInt(rawLimit) || 500, 5000);

  const conditions = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(filter)) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) continue; // skip unsafe keys
    if (val === null || val === undefined) {
      conditions.push(`${key} IS NULL`);
    } else if (Array.isArray(val)) {
      conditions.push(`${key} = ANY($${idx})`);
      values.push(val);
      idx++;
    } else {
      conditions.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);

  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT $${idx}`,
      values
    );
    if(table==='users')rows.forEach(r=>delete r.password_hash);
    if(table==='organizations')return res.json(sanitizeOrganizationRows(rows,await organizationContext(req)));
    if(table==='nofos')return res.json(sanitizeNofoRows(rows,await organizationContext(req)));
    res.json(rows);
  } catch (err) {
    console.error(`Filter ${table}:`, err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── GET ONE  GET /api/entities/:entity/:id ────────────────────
router.get('/:entity/:id', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row=rows[0];
    if(table==='users')delete row.password_hash;
    if(table==='organizations')return res.json(stripLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='nofos')return res.json(stripNofoLegacyFields(row,(await organizationContext(req)).enabled));
    res.json(row);
  } catch (err) {
    console.error(`Get ${table}:`, err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ── CREATE  POST /api/entities/:entity ────────────────────────
router.post('/:entity', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  let data = { ...req.body };
  // Don't allow client to set id or timestamps
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  if(table==='grantees'){try{assertLegacyGranteeMutation(req.user,data)}catch(error){return res.status(error.status||403).json({error:error.message})}}
  if(table==='organizations'){try{const context=await organizationContext(req);assertLegacyOrganizationMutation(req.user,data,context);data=await normalizeOrganizationInput(pool,data,{isCreate:true,grantee:context.grantee})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='nofos'){try{const context=await organizationContext(req);assertLegacyNofoMutation(req.user,data,context);data=await normalizeNofoInput(data,{isCreate:true});if(!context.canEdit)delete data.legacy_grant_id}catch(error){return res.status(error.status||400).json({error:error.message})}}
  const keys=Object.keys(data);
  if(table==='applications'){try{data=await normalizeApplicationInput(pool,data,{})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(!keys.length)return res.status(400).json({error:'No data provided'});

  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map(k => {
    const v = data[k];
    // Serialize arrays/objects to JSON for JSONB columns
    if (v !== null && typeof v === 'object') return JSON.stringify(v);
    return v;
  });

  try {
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    const row = rows[0];
    if (table === 'users') delete row.password_hash;
    if (table === 'organizations') return res.status(201).json(stripLegacyFields(row, (await organizationContext(req)).enabled));
    if (table === 'nofos') return res.status(201).json(stripNofoLegacyFields(row, (await organizationContext(req)).enabled));
    res.status(201).json(row);
  } catch (err) {
    console.error(`Create ${table}:`, err);
    res.status(500).json({ error: 'Insert failed', detail: err.message });
  }
});

// ── UPDATE  PUT /api/entities/:entity/:id ─────────────────────
router.put('/:entity/:id', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });
  if (table === 'users') {
    try { return res.json(await updateManagedAccount(pool,req.user.id,req.params.id,req.body,req.ip)); }
    catch(error) { return res.status(error.status||500).json({error:error.status?error.message:'Unable to update account'}); }
  }


  let data = { ...req.body };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  if(table==='organizations'){try{const context=await organizationContext(req);data=await normalizeOrganizationInput(pool,data,{orgId:req.params.id,grantee:context.grantee})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='nofos'){try{const context=await organizationContext(req);assertLegacyNofoMutation(req.user,data,context);data=await normalizeNofoInput(data,{isCreate:false});if(!context.canEdit)delete data.legacy_grant_id}catch(error){return res.status(error.status||400).json({error:error.message})}}

  const keys = Object.keys(data);
  if(table==='applications'){try{data=await normalizeApplicationInput(pool,data,{id:req.params.id})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if (!keys.length) return res.status(400).json({ error: 'No data provided' });

  if(table==='grantees'){try{assertLegacyGranteeMutation(req.user,data)}catch(error){return res.status(error.status||403).json({error:error.message})}}
  if(table==='organizations'){try{assertLegacyOrganizationMutation(req.user,data,await organizationContext(req))}catch(error){return res.status(error.status||403).json({error:error.message})}}
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = [
    req.params.id,
    ...keys.map(k => {
      const v = data[k];
      if (v !== null && typeof v === 'object') return JSON.stringify(v);
      return v;
    }),
  ];

  try {
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    if (table === 'users') delete row.password_hash;
    if (table === 'organizations') return res.json(stripLegacyFields(row, (await organizationContext(req)).enabled));
    if (table === 'nofos') return res.json(stripNofoLegacyFields(row, (await organizationContext(req)).enabled));
    res.json(row);
  } catch (err) {
    console.error(`Update ${table}:`, err);
    res.status(500).json({ error: 'Update failed', detail: err.message });
  }
});

// ── DELETE  DELETE /api/entities/:entity/:id ───────────────────
router.delete('/:entity/:id', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(`Delete ${table}:`, err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
