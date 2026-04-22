import { base44 } from '@/api/base44Client';
import { DATA_SOURCES, SUBRECIPIENT_SOURCES, FIELD_GROUPS } from './reportDataSources';

// Entity name → base44 entity key
const ENTITY_MAP = {
  Application: 'Application',
  Organization: 'Organization',
  Nofo: 'Nofo',
  FundingRequest: 'FundingRequest',
  FundingRequestLineItem: 'FundingRequestLineItem',
  ProgressReport: 'ProgressReport',
  ReportSchedule: 'ReportSchedule',
  ComplianceFlag: 'ComplianceFlag',
  GrantProgram: 'GrantProgram',
  ApplicationReview: 'ApplicationReview',
  ApplicationBudget: 'ApplicationBudget',
};

// Fetch raw data for a source (with optional org restriction for subrecipients)
export async function fetchSourceData(sourceKey, orgFilter = null) {
  const src = DATA_SOURCES[sourceKey] || SUBRECIPIENT_SOURCES[sourceKey];
  if (!src) return [];

  const fetched = {};
  await Promise.all(
    src.entities.map(async (entity) => {
      const e = base44.entities[ENTITY_MAP[entity]];
      if (!e) return;
      if (orgFilter && entity === 'Application') {
        fetched[entity] = await e.filter({ organization_id: orgFilter }, '-created_date', 500);
      } else if (orgFilter && (entity === 'FundingRequest' || entity === 'ProgressReport' || entity === 'ReportSchedule')) {
        fetched[entity] = await e.filter({ organization_id: orgFilter }, '-created_date', 500);
      } else {
        fetched[entity] = await e.list('-created_date', 500);
      }
    })
  );

  // For single-entity sources, just return the rows
  const primary = src.entities[0];
  if (src.entities.length === 1) {
    return (fetched[primary] || []).map(row => ({ ...row, _entity: primary }));
  }

  // For combined views: left-join secondary entities onto primary
  const primaryRows = fetched[primary] || [];
  const joinDef = src.join?.[primary] || {};

  // Build lookup maps for secondary entities
  const lookups = {};
  src.entities.slice(1).forEach(entity => {
    lookups[entity] = {};
    (fetched[entity] || []).forEach(r => { lookups[entity][r.id] = r; });
  });

  return primaryRows.map(row => {
    const merged = { ...row, _entity: primary };
    Object.entries(joinDef).forEach(([fkField, targetEntity]) => {
      const fkValue = row[fkField];
      const related = lookups[targetEntity]?.[fkValue] || {};
      // Prefix related entity fields to avoid collisions
      const prefix = targetEntity.toLowerCase() + '_';
      Object.entries(related).forEach(([k, v]) => {
        if (!['id', 'created_date', 'updated_date', 'created_by'].includes(k)) {
          merged[prefix + k] = v;
        }
      });
    });
    return merged;
  });
}

// Apply calculated fields to a row
function applyCalcFields(row, selectedFields, allFieldDefs) {
  const enriched = { ...row };
  selectedFields.forEach(sf => {
    const def = allFieldDefs.find(f => f.key === sf.key);
    if (def?.calc) {
      enriched[sf.key] = def.calc(row);
    }
  });
  return enriched;
}

// Get flat list of all field defs for a source
function getAllFieldDefs(sourceKey) {
  const src = DATA_SOURCES[sourceKey] || SUBRECIPIENT_SOURCES[sourceKey];
  if (!src) return [];
  return src.entities.flatMap(e => FIELD_GROUPS[e] || []);
}

// Evaluate a single filter condition
function evalFilter(row, filter, allFieldDefs) {
  const { field, operator, value } = filter;
  const def = allFieldDefs.find(f => f.key === field);
  let rawVal = row[field];

  // Try calc field
  if (def?.calc && rawVal === undefined) rawVal = def.calc(row);

  const strVal = rawVal?.toString?.()?.toLowerCase?.() || '';
  const filterVal = value?.toString?.()?.toLowerCase?.() || '';

  switch (operator) {
    case 'is': return strVal === filterVal;
    case 'is_not': return strVal !== filterVal;
    case 'contains': return strVal.includes(filterVal);
    case 'not_contains': return !strVal.includes(filterVal);
    case 'starts_with': return strVal.startsWith(filterVal);
    case 'is_blank': return rawVal == null || rawVal === '';
    case 'is_not_blank': return rawVal != null && rawVal !== '';
    case 'equals': return Number(rawVal) === Number(value);
    case 'not_equals': return Number(rawVal) !== Number(value);
    case 'gt': return Number(rawVal) > Number(value);
    case 'lt': return Number(rawVal) < Number(value);
    case 'gte': return Number(rawVal) >= Number(value);
    case 'lte': return Number(rawVal) <= Number(value);
    case 'is_true': return rawVal === true || rawVal === 'true';
    case 'is_false': return rawVal === false || rawVal === 'false' || rawVal == null;
    case 'is_one_of': {
      const vals = Array.isArray(value) ? value.map(v => v.toLowerCase()) : [filterVal];
      return vals.includes(strVal);
    }
    case 'date_before': return rawVal && new Date(rawVal) < new Date(value);
    case 'date_after': return rawVal && new Date(rawVal) > new Date(value);
    case 'last_n_days': {
      const n = parseInt(value, 10);
      return rawVal && new Date(rawVal) >= new Date(Date.now() - n * 86400000);
    }
    case 'next_n_days': {
      const n = parseInt(value, 10);
      const d = rawVal && new Date(rawVal);
      return d && d >= new Date() && d <= new Date(Date.now() + n * 86400000);
    }
    default: return true;
  }
}

// Run the full report: fetch → filter → calc → sort
export async function runReport(config, orgFilter = null) {
  const { data_source, selected_fields = [], filters = [], filter_logic = 'AND', sort_rules = [] } = config;

  let rows = await fetchSourceData(data_source, orgFilter);
  const allFieldDefs = getAllFieldDefs(data_source);

  // Apply calculated fields
  rows = rows.map(row => applyCalcFields(row, selected_fields, allFieldDefs));

  // Apply filters
  if (filters.length > 0) {
    rows = rows.filter(row => {
      const results = filters.map(f => evalFilter(row, f, allFieldDefs));
      return filter_logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
    });
  }

  // Apply sort
  if (sort_rules.length > 0) {
    rows.sort((a, b) => {
      for (const rule of sort_rules) {
        const av = a[rule.field] ?? '';
        const bv = b[rule.field] ?? '';
        let cmp = 0;
        if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv;
        } else {
          cmp = av.toString().localeCompare(bv.toString());
        }
        if (cmp !== 0) return rule.direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  return rows;
}

// Export rows to CSV and trigger download
export function exportToCSV(rows, selectedFields, reportName) {
  if (!rows.length) return;
  const headers = selectedFields.map(f => f.label);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      selectedFields.map(f => {
        const val = row[f.key] ?? '';
        const s = val.toString().replace(/"/g, '""');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
      }).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportName || 'report'}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}