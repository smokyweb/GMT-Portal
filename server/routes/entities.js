import { Router } from 'express';
import pool from '../db/connection.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ── Entity name → Postgres table mapping ──────────────────────
const TABLE_MAP = {
  Application:             'applications',
  ApplicationBudget:       'application_budgets',
  ApplicationReview:       'application_reviews',
  AuditLog:                'audit_logs',
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
};

function resolveTable(entity) {
  const table = TABLE_MAP[entity];
  if (!table) return null;
  return table;
}

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
    // Strip password_hash from User rows
    if (table === 'users') {
      rows.forEach(r => delete r.password_hash);
    }
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
    if (table === 'users') {
      rows.forEach(r => delete r.password_hash);
    }
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
    const row = rows[0];
    if (table === 'users') delete row.password_hash;
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

  const data = { ...req.body };
  // Don't allow client to set id or timestamps
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'No data provided' });

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

  const data = { ...req.body };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  const keys = Object.keys(data);
  if (!keys.length) return res.status(400).json({ error: 'No data provided' });

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
