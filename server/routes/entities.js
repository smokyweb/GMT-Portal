import {createProgramFormEntityAccess} from '../middleware/programFormEntityAccess.js';
import {createApplicationBudgetAccess} from '../middleware/applicationBudgetAccess.js';
import {createNofoFormEntityAccess} from '../middleware/nofoFormEntityAccess.js';
import { Router } from 'express';
import pool from '../db/connection.js';
import { authRequired } from '../middleware/auth.js';
import { guardUserMutation } from '../middleware/userEntityAccess.js';
import { updateManagedAccount } from '../services/accountUpdates.js';
import { legacyContext,stripLegacyFields,stripNofoLegacyFields,stripProjectLegacyFields,stripFundingLineLegacyFields,stripBudgetLegacyFields,stripFundingRequestLegacyFields,stripApplicationLegacyFields,assertLegacyGranteeMutation,assertLegacyOrganizationMutation,assertLegacyNofoMutation,assertLegacyProjectMutation,assertLegacyFundingLineMutation } from '../services/legacyFields.js';
import {formActor,assertApplicationAccess} from '../services/forms/formAccess.js';
import { normalizeOrganizationInput } from '../services/organizationPolicy.js';
import { normalizeApplicationInput } from '../services/forms/applicationFormSave.js';
import { normalizeNofoInput } from '../services/nofoPolicy.js';
import { mutateFunding } from '../services/ehp/fundingMutations.js';
import { assertOrganizationAccess } from '../services/organizationMembership.js';

const router = Router();
router.use('/:entity', authRequired);
router.use('/:entity/:id?', guardUserMutation);
router.use('/:entity/:id?',createApplicationBudgetAccess(),createNofoFormEntityAccess(),createProgramFormEntityAccess());

// ── Entity name → Postgres table mapping ──────────────────────
const TABLE_MAP = {
  Application:             'applications',
  Project:                 'projects',
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
function sanitizeProjectRows(rows,context){return rows.map(row=>stripProjectLegacyFields(row,context.enabled))}
function sanitizeFundingLineRows(rows,context){return rows.map(row=>stripFundingLineLegacyFields(row,context.enabled))}
function sanitizeBudgetRows(rows,context){return rows.map(row=>stripBudgetLegacyFields(row,context.enabled))}
function sanitizeFundingRequestRows(rows,context){return rows.map(row=>stripFundingRequestLegacyFields(row,context.enabled))}
function sanitizeApplicationRows(rows,context){return rows.map(row=>stripApplicationLegacyFields(row,context.enabled))}
const LEGACY_FIELDS_BY_TABLE={
  organizations:['legacy_spars_id','duns','region'],
  nofos:['legacy_grant_id'],
  projects:['legacy_project_id'],
  funding_request_line_items:['legacy_expenditure_id'],
  application_budgets:['legacy_budget_line_id'],
  applications:['legacy_subaward_id'],
};
function removeLegacyMutationFields(table,data){for(const key of LEGACY_FIELDS_BY_TABLE[table]||[])delete data[key];return data}

async function assertUserEntityAccess(db, actor, table, id, data = {}) {
  if (actor?.role !== 'user') return;
  let organizationId = data.organization_id || null;
  if (table === 'organizations') organizationId = organizationId || id;
  if (['applications'].includes(table)) organizationId = organizationId || (await db.query('SELECT organization_id FROM applications WHERE id::text=$1',[id])).rows[0]?.organization_id;
  if (['projects','application_budgets','application_reviews','compliance_flags','milestones','report_schedules','progress_reports','budget_amendments'].includes(table)) {
    const appIdColumn = table === 'compliance_flags' ? 'application_id' : table === 'projects' || table === 'application_budgets' || table === 'application_reviews' ? 'application_id' : 'application_id';
    const existing = id ? (await db.query(`SELECT a.organization_id FROM ${table} entity JOIN applications a ON a.id::text=entity.${appIdColumn}::text WHERE entity.id::text=$1`,[id])).rows[0]?.organization_id : null;
    const fromApplication = data.application_id ? (await db.query('SELECT organization_id FROM applications WHERE id::text=$1',[data.application_id])).rows[0]?.organization_id : null;
    organizationId = organizationId || existing || fromApplication;
  }
  if (table === 'funding_requests') organizationId = organizationId || (await db.query('SELECT organization_id FROM funding_requests WHERE id::text=$1',[id])).rows[0]?.organization_id;
  if (table === 'funding_request_line_items') organizationId = organizationId || (await db.query('SELECT fr.organization_id FROM funding_request_line_items li JOIN funding_requests fr ON fr.id::text=li.funding_request_id::text WHERE li.id::text=$1',[id])).rows[0]?.organization_id;
  if (table === 'documents') {
    organizationId = organizationId || (id ? (await db.query(`SELECT COALESCE(d.organization_id,a.organization_id) organization_id FROM documents d LEFT JOIN applications a ON a.id::text=d.application_id::text WHERE d.id::text=$1`,[id])).rows[0]?.organization_id : null);
    organizationId = organizationId || (data.application_id ? (await db.query('SELECT organization_id FROM applications WHERE id::text=$1',[data.application_id])).rows[0]?.organization_id : null);
  }
  if (table === 'saved_reports') organizationId = organizationId || id && (await db.query('SELECT organization_id FROM saved_reports WHERE id::text=$1',[id])).rows[0]?.organization_id;
  if (table === 'generated_documents' || table === 'messages' || table === 'credits' || table === 'tasks') organizationId = organizationId || (await db.query(`SELECT organization_id FROM ${table} WHERE id::text=$1`,[id])).rows[0]?.organization_id;
  if (organizationId) assertOrganizationAccess(actor,organizationId);
}

const ENTITY_COLLECTION_LIMIT = 5000;

function parseCollectionLimit(rawLimit) {
  const limit = Number(rawLimit);
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, ENTITY_COLLECTION_LIMIT)
    : ENTITY_COLLECTION_LIMIT;
}

// Use the primary key to keep rows with equal sort values in a stable order.
function parseSort(sortStr) {
  const defaultSort = 'created_date DESC, id ASC';
  if (typeof sortStr !== 'string') return defaultSort;
  const desc = sortStr.startsWith('-');
  const col = desc ? sortStr.slice(1) : sortStr;
  // Whitelist: only allow alphanumeric + underscore column names
  if (!/^[a-z_][a-z0-9_]*$/i.test(col)) return defaultSort;
  const sort = `${col} ${desc ? 'DESC' : 'ASC'}`;
  return col.toLowerCase() === 'id' ? sort : `${sort}, id ASC`;
}

// State-scoped users must never receive another state's rows. Keep this in
// the entity query rather than relying on browser-side filtering.
function stateScope(table, actor, offset = 0) {
  if(actor?.role==='user') {
    const param = `$${offset + 1}`;
    const member = column => `EXISTS (SELECT 1 FROM user_organizations viewer_membership WHERE viewer_membership.user_id=${param} AND viewer_membership.organization_id::text=${column})`;
    switch(table) {
      case 'organizations': return {sql:member('organizations.id::text'),value:actor.id};
      case 'users': return {sql:`EXISTS (SELECT 1 FROM user_organizations target_membership JOIN user_organizations viewer_membership ON viewer_membership.organization_id=target_membership.organization_id WHERE target_membership.user_id=users.id::text AND viewer_membership.user_id=${param})`,value:actor.id};
      case 'applications': return {sql:member('applications.organization_id'),value:actor.id};
      case 'projects': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=projects.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'application_budgets': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=application_budgets.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'application_reviews': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=application_reviews.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'funding_requests': return {sql:member('funding_requests.organization_id'),value:actor.id};
      case 'funding_request_line_items': return {sql:`EXISTS (SELECT 1 FROM funding_requests scope_fr WHERE scope_fr.id::text=funding_request_line_items.funding_request_id AND ${member('scope_fr.organization_id')})`,value:actor.id};
      case 'documents': return {sql:`(${member('documents.organization_id')} OR EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=documents.application_id AND ${member('scope_app.organization_id')}))`,value:actor.id};
      case 'generated_documents': return {sql:member('generated_documents.organization_id'),value:actor.id};
      case 'milestones': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=milestones.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'report_schedules': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=report_schedules.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'progress_reports': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=progress_reports.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'budget_amendments': return {sql:`EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=budget_amendments.application_id AND ${member('scope_app.organization_id')})`,value:actor.id};
      case 'saved_reports': return {sql:member('saved_reports.organization_id'),value:actor.id};
      case 'tasks': return {sql:`(${member('tasks.organization_id')} OR EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=tasks.application_id AND ${member('scope_app.organization_id')}))`,value:actor.id};
      case 'messages': return {sql:member('messages.organization_id'),value:actor.id};
      case 'credits': return {sql:member('credits.organization_id'),value:actor.id};
      default: break;
    }
  }
  const state = String(actor?.scope_state || '').trim().toUpperCase();
  if (!state) return null;
  const param = `$${offset + 1}`;
  const orgFor = column => `EXISTS (SELECT 1 FROM organizations scope_org WHERE scope_org.id::text=${column} AND btrim(COALESCE(scope_org.state,''))<>'' AND upper(scope_org.state)=upper(${param}))`;
  switch (table) {
    case 'organizations': return { sql: `btrim(COALESCE(organizations.state,''))<>'' AND upper(organizations.state)=upper(${param})`, value: state };
    case 'users': return { sql: `upper(COALESCE(NULLIF(users.scope_state,''), (SELECT state FROM organizations user_org WHERE user_org.id::text=users.organization_id), ''))=upper(${param})`, value: state };
    case 'grantees': return { sql: `btrim(COALESCE(grantees.state_code,''))<>'' AND upper(grantees.state_code)=upper(${param})`, value: state };
    case 'nofos': return { sql: `COALESCE(nofos.scope_states,'[]'::jsonb) ? ${param}`, value: state };
    case 'applications': return { sql: orgFor('applications.organization_id'), value: state };
    case 'projects': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=projects.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'application_budgets': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=application_budgets.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'application_reviews': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=application_reviews.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'funding_requests': return { sql: orgFor('funding_requests.organization_id'), value: state };
    case 'funding_request_line_items': return { sql: `EXISTS (SELECT 1 FROM funding_requests scope_fr WHERE scope_fr.id::text=funding_request_line_items.funding_request_id AND ${orgFor('scope_fr.organization_id')})`, value: state };
    case 'compliance_flags': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=compliance_flags.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'documents': return { sql: `(${orgFor('documents.organization_id')} OR EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=documents.application_id AND ${orgFor('scope_app.organization_id')}))`, value: state };
    case 'generated_documents': return { sql: orgFor('generated_documents.organization_id'), value: state };
    case 'milestones': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=milestones.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'report_schedules': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=report_schedules.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'progress_reports': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=progress_reports.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'budget_amendments': return { sql: `EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=budget_amendments.application_id AND ${orgFor('scope_app.organization_id')})`, value: state };
    case 'saved_reports': return { sql: orgFor('saved_reports.organization_id'), value: state };
    case 'tasks': return { sql: `(${orgFor('tasks.organization_id')} OR EXISTS (SELECT 1 FROM applications scope_app WHERE scope_app.id::text=tasks.application_id AND ${orgFor('scope_app.organization_id')}))`, value: state };
    default: return null;
  }
}

// ── LIST  GET /api/entities/:entity ───────────────────────────
// Query params: sort (e.g. "-created_date"), limit (number)
router.get('/:entity', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });

  const sort = parseSort(req.query.sort);
  const limit = parseCollectionLimit(req.query.limit);

  try {
    // Organizations are associated with a Grantee through their state in the
    // current production data model. Honor the Grantee selector used by the
    // Organizations screen instead of returning every organization's row.
    const conditions = [];
    let values = [];
    if (table === 'organizations' && req.query.grantee_id) {
      const grantee = (await pool.query(
        'SELECT state_code FROM grantees WHERE id::text=$1',
        [req.query.grantee_id]
      )).rows[0];
      if (!grantee?.state_code) return res.json([]);
      conditions.push(`upper(organizations.state)=upper($${values.length + 1})`);
      values.push(grantee.state_code);
    }
    if (table === 'funding_requests' && req.query.payment_status) {
      const paymentStatus = String(req.query.payment_status);
      if (paymentStatus === '__not_submitted__') {
        conditions.push(`(funding_requests.payment_status IS NULL OR btrim(funding_requests.payment_status)='')`);
      } else {
        conditions.push(`funding_requests.payment_status=$${values.length + 1}`);
        values.push(paymentStatus);
      }
    }
    const scope = stateScope(table, req.user, values.length);
    if (scope) { conditions.push(scope.sql); values.push(scope.value); }
    values.push(limit);
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM ${table}${where} ORDER BY ${sort} LIMIT $${values.length}`,
      values
    );
    if(table==='users')rows.forEach(r=>delete r.password_hash);
    if(table==='organizations')return res.json(sanitizeOrganizationRows(rows,await organizationContext(req)));
    if(table==='nofos')return res.json(sanitizeNofoRows(rows,await organizationContext(req)));
    if(table==='projects')return res.json(sanitizeProjectRows(rows,await organizationContext(req)));
    if(table==='funding_request_line_items')return res.json(sanitizeFundingLineRows(rows,await organizationContext(req)));
    if(table==='application_budgets')return res.json(sanitizeBudgetRows(rows,await organizationContext(req)));
    if(table==='funding_requests')return res.json(sanitizeFundingRequestRows(rows,await organizationContext(req)));
    if(table==='applications')return res.json(sanitizeApplicationRows(rows,await organizationContext(req)));
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
  const limit = parseCollectionLimit(rawLimit);

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

  const scope = stateScope(table, req.user, values.length);
  if (scope) { conditions.push(scope.sql); values.push(scope.value); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);
  const limitParam = values.length;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT $${limitParam}`,
      values
    );
    if(table==='users')rows.forEach(r=>delete r.password_hash);
    if(table==='organizations')return res.json(sanitizeOrganizationRows(rows,await organizationContext(req)));
    if(table==='nofos')return res.json(sanitizeNofoRows(rows,await organizationContext(req)));
    if(table==='projects')return res.json(sanitizeProjectRows(rows,await organizationContext(req)));
    if(table==='funding_request_line_items')return res.json(sanitizeFundingLineRows(rows,await organizationContext(req)));
    if(table==='application_budgets')return res.json(sanitizeBudgetRows(rows,await organizationContext(req)));
    if(table==='funding_requests')return res.json(sanitizeFundingRequestRows(rows,await organizationContext(req)));
    if(table==='applications')return res.json(sanitizeApplicationRows(rows,await organizationContext(req)));
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
    await assertUserEntityAccess(pool,req.user,table,req.params.id);
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row=rows[0];
    if(table==='users')delete row.password_hash;
    if(table==='organizations')return res.json(stripLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='nofos')return res.json(stripNofoLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='projects')return res.json(stripProjectLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='funding_request_line_items')return res.json(stripFundingLineLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='application_budgets')return res.json(stripBudgetLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='funding_requests')return res.json(stripFundingRequestLegacyFields(row,(await organizationContext(req)).enabled));
    if(table==='applications')return res.json(stripApplicationLegacyFields(row,(await organizationContext(req)).enabled));
    res.json(row);
  } catch (err) {
    console.error(`Get ${table}:`, err);
    res.status(err.status||500).json({ error: err.status ? err.message : 'Query failed' });
  }
});

// ── CREATE  POST /api/entities/:entity ────────────────────────
router.post('/:entity', authRequired, async (req, res) => {
  const table = resolveTable(req.params.entity);
  if (!table) return res.status(404).json({ error: 'Unknown entity' });
  if (table === 'funding_requests' || table === 'funding_request_line_items') {
    try { return res.status(201).json(await mutateFunding(pool, req.user.id, req.params.entity, null, req.body, 'POST')); }
    catch (error) { return res.status(error.status || 500).json({ error: error.message }); }
  }

  let data = { ...req.body };
  try { await assertUserEntityAccess(pool,req.user,table,null,data); } catch(error) { return res.status(error.status||403).json({error:error.message}); }
  removeLegacyMutationFields(table,data);
  // Don't allow client to set id or timestamps
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  if(table==='grantees'){try{assertLegacyGranteeMutation(req.user,data)}catch(error){return res.status(error.status||403).json({error:error.message})}}
  if(table==='organizations'){try{const context=await organizationContext(req);assertLegacyOrganizationMutation(req.user,data,context);data=await normalizeOrganizationInput(pool,data,{isCreate:true,grantee:context.grantee})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='nofos'){try{const context=await organizationContext(req);assertLegacyNofoMutation(req.user,data,context);data=await normalizeNofoInput(data,{isCreate:true});if(!context.canEdit)delete data.legacy_grant_id}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='projects'){
    try {
      const actor=await formActor(pool,req.user.id),application=(await pool.query('SELECT * FROM applications WHERE id::text=$1',[data.application_id])).rows[0];
      if(!application)return res.status(400).json({error:'Select an existing application'});
      const organization=(await pool.query('SELECT * FROM organizations WHERE id::text=$1',[application.organization_id])).rows[0];
      assertApplicationAccess(actor,application,organization,true);assertLegacyProjectMutation(actor,data,await organizationContext(req));delete data.is_legacy_backfill;
    } catch(error){return res.status(error.status||400).json({error:error.message})}
  }
  if(table==='funding_request_line_items'){try{assertLegacyFundingLineMutation(req.user,data,await organizationContext(req));}catch(error){return res.status(error.status||403).json({error:error.message})}}
  if(table==='progress_reports'&&data.project_id){
    const project=(await pool.query('SELECT id FROM projects WHERE id::text=$1 AND application_id=$2',[data.project_id,data.application_id])).rows[0];
    if(!project)return res.status(400).json({error:'Choose a project from this application'});
  }
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
    if (table === 'projects') return res.status(201).json(stripProjectLegacyFields(row, (await organizationContext(req)).enabled));
    if (table === 'applications') return res.status(201).json(stripApplicationLegacyFields(row, (await organizationContext(req)).enabled));
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
  if (table === 'funding_requests' || table === 'funding_request_line_items') {
    try { return res.json(await mutateFunding(pool, req.user.id, req.params.entity, req.params.id, req.body)); }
    catch (error) { return res.status(error.status || 500).json({ error: error.message }); }
  }
  if (table === 'users') {
    try { return res.json(await updateManagedAccount(pool,req.user.id,req.params.id,req.body,req.ip)); }
    catch(error) { return res.status(error.status||500).json({error:error.status?error.message:'Unable to update account'}); }
  }


  let data = { ...req.body };
  try { await assertUserEntityAccess(pool,req.user,table,req.params.id,data); } catch(error) { return res.status(error.status||403).json({error:error.message}); }
  removeLegacyMutationFields(table,data);
  delete data.id;
  delete data.created_date;
  delete data.updated_date;

  if(table==='organizations'){try{const context=await organizationContext(req);data=await normalizeOrganizationInput(pool,data,{orgId:req.params.id,grantee:context.grantee})}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='nofos'){try{const context=await organizationContext(req);assertLegacyNofoMutation(req.user,data,context);data=await normalizeNofoInput(data,{isCreate:false});if(!context.canEdit)delete data.legacy_grant_id}catch(error){return res.status(error.status||400).json({error:error.message})}}
  if(table==='projects'){
    try {
      const actor=await formActor(pool,req.user.id),previous=(await pool.query('SELECT * FROM projects WHERE id::text=$1',[req.params.id])).rows[0];
      if(!previous)return res.status(404).json({error:'Project not found'});
      const application=(await pool.query('SELECT * FROM applications WHERE id::text=$1',[previous.application_id])).rows[0],organization=(await pool.query('SELECT * FROM organizations WHERE id::text=$1',[application?.organization_id])).rows[0];
      if(data.application_id&&data.application_id!==previous.application_id)throw Object.assign(new Error('A project cannot move to another application'),{status:400});
      assertApplicationAccess(actor,application,organization,true);assertLegacyProjectMutation(actor,data,await organizationContext(req));delete data.application_id;delete data.is_legacy_backfill;
    } catch(error){return res.status(error.status||400).json({error:error.message})}
  }
  if(table==='funding_request_line_items'){try{assertLegacyFundingLineMutation(req.user,data,await organizationContext(req));}catch(error){return res.status(error.status||403).json({error:error.message})}}
  if(table==='progress_reports'&&data.project_id){
    const existingReport=(await pool.query('SELECT application_id FROM progress_reports WHERE id::text=$1',[req.params.id])).rows[0];
    const project=(await pool.query('SELECT id FROM projects WHERE id::text=$1 AND application_id=$2',[data.project_id,existingReport?.application_id||data.application_id])).rows[0];
    if(!project)return res.status(400).json({error:'Choose a project from this application'});
  }

  const keys = Object.keys(data);
  if(table==='applications'){
    try{
      const actor=await formActor(pool,req.user.id),previous=(await pool.query('SELECT * FROM applications WHERE id::text=$1',[req.params.id])).rows[0];
      if(!previous)return res.status(404).json({error:'Application not found'});
      const organization=(await pool.query('SELECT * FROM organizations WHERE id::text=$1',[previous.organization_id])).rows[0];
      assertApplicationAccess(actor,previous,organization,true);
      if(data.status==='Submitted'){
        const projectsTable=(await pool.query("SELECT to_regclass(current_schema()||'.projects') AS name")).rows[0]?.name;
        const projects=projectsTable?(await pool.query('SELECT title,project_zip,is_legacy_backfill,is_active FROM projects WHERE application_id=$1 AND is_active=true',[req.params.id])).rows:[];
        if(projectsTable&&!projects.length)throw Object.assign(new Error('Add at least one active Project before submitting'),{status:422});
        for(const [index,project] of projects.entries()){
          if(!String(project.title||'').trim())throw Object.assign(new Error(`Project ${index+1} needs a title`),{status:422});
          if(!project.is_legacy_backfill&&!/^\d{5}$/.test(String(project.project_zip||'')))throw Object.assign(new Error(`Project ${index+1} needs a 5-digit ZIP`),{status:422});
        }
      }
      data=await normalizeApplicationInput(pool,data,{id:req.params.id})
    }catch(error){return res.status(error.status||400).json({error:error.message})}
  }
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
    if (table === 'projects') return res.json(stripProjectLegacyFields(row, (await organizationContext(req)).enabled));
    if (table === 'funding_request_line_items') return res.json(stripFundingLineLegacyFields(row, (await organizationContext(req)).enabled));
    if (table === 'applications') return res.json(stripApplicationLegacyFields(row, (await organizationContext(req)).enabled));
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
  if (table === 'funding_requests' || table === 'funding_request_line_items') {
    try { return res.json(await mutateFunding(pool, req.user.id, req.params.entity, req.params.id, {}, 'DELETE')); }
    catch (error) { return res.status(error.status || 500).json({ error: error.message }); }
  }

  try {
    await assertUserEntityAccess(pool,req.user,table,req.params.id);
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
