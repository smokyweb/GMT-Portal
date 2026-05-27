/**
 * seed.js — Import CSV files into the GMT Portal database.
 *
 * Usage:
 *   node db/seed.js <EntityName> <path/to/file.csv>
 *
 * Example:
 *   node db/seed.js Organization ./data/organizations.csv
 *   node db/seed.js Application  ./data/applications.csv
 *
 * The CSV header row must match the database column names.
 * Entity name must match a known entity (e.g. Application, Organization).
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import pool from './connection.js';

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

async function seed(entityName, csvPath) {
  const table = TABLE_MAP[entityName];
  if (!table) {
    console.error(`Unknown entity: ${entityName}`);
    console.error('Valid entities:', Object.keys(TABLE_MAP).join(', '));
    process.exit(1);
  }

  const records = [];

  await new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          if (value === '') return null;
          // Try to detect booleans
          if (value.toLowerCase() === 'true') return true;
          if (value.toLowerCase() === 'false') return false;
          return value;
        },
      }))
      .on('data', (row) => records.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  if (!records.length) {
    console.log('No records found in CSV.');
    await pool.end();
    return;
  }

  console.log(`Parsed ${records.length} records from ${csvPath}`);

  // Query actual table columns from DB so we skip unknown CSV columns gracefully
  const colResult = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
    [table]
  );
  const tableColumns = new Set(colResult.rows.map(r => r.column_name));

  // Filter CSV columns to only those that exist in the table (skip 'id' - auto-generated)
  const allCsvColumns = Object.keys(records[0]);
  const columns = allCsvColumns.filter(c => c !== 'id' && tableColumns.has(c));
  const skipped = allCsvColumns.filter(c => c !== 'id' && !tableColumns.has(c));
  if (skipped.length) {
    console.log(`Skipping ${skipped.length} unknown columns: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '...' : ''}`);
  }

  let inserted = 0;
  let errors = 0;

  for (const record of records) {
    const values = columns.map(col => {
      const val = record[col];
      if (val === null || val === undefined) return null;
      // If value looks like a JSON array/object, keep as-is for JSONB columns
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        return val;
      }
      return val;
    });

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    try {
      await pool.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.error(`Row error:`, err.message);
      }
    }
  }

  console.log(`Done: ${inserted} inserted, ${errors} errors`);
  await pool.end();
}

// ── CLI ───────────────────────────────────────────────────────
const [entityName, csvPath] = process.argv.slice(2);

if (!entityName || !csvPath) {
  console.log('Usage: node db/seed.js <EntityName> <path/to/file.csv>');
  console.log('Example: node db/seed.js Organization ./data/organizations.csv');
  process.exit(1);
}

seed(entityName, csvPath);
