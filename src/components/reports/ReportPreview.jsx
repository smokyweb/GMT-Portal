import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDateShort } from '../../lib/helpers';
import StatusBadge from '../StatusBadge';

const PAGE_SIZE = 25;

const STATUS_FIELDS = new Set(['status', 'flag_type', 'severity', 'report_type', 'request_type']);
const CURRENCY_FIELDS = new Set(['requested_amount','awarded_amount','match_amount','total_expended',
  'remaining_balance','amount_requested','amount_approved','match_documented','amount',
  'expenditure_ytd','match_ytd','total_funding_available','min_award','max_award',
  '_remaining_balance_calc','_match_gap']);
const PERCENT_FIELDS = new Set(['expenditure_rate']);
const DATE_FIELDS = new Set(['submitted_at','created_date','performance_start','performance_end',
  'period_start','period_end','due_date','open_date','close_date']);
const CALC_FIELD_PREFIX = '_';

function formatCell(key, value, label) {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  if (CURRENCY_FIELDS.has(key)) return <span className="font-mono">{formatCurrency(value)}</span>;
  if (PERCENT_FIELDS.has(key)) return <span>{Number(value).toFixed(1)}%</span>;
  if (DATE_FIELDS.has(key)) return <span>{formatDateShort(value)}</span>;
  if (key === 'is_resolved' || key === 'is_allowable' || key === 'is_active') {
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {value ? 'Yes' : 'No'}
    </span>;
  }
  if (STATUS_FIELDS.has(key)) {
    return <StatusBadge status={value} />;
  }
  return <span>{value.toString()}</span>;
}

export default function ReportPreview({ rows, selectedFields, loading, totalRows }) {
  const [page, setPage] = useState(0);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);

  // Summary bar
  const currencyTotals = selectedFields.filter(f => CURRENCY_FIELDS.has(f.key)).slice(0, 3).map(f => ({
    label: f.label,
    sum: rows.reduce((s, r) => s + (Number(r[f.key]) || 0), 0),
  }));

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 bg-muted animate-pulse rounded" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }

  if (!selectedFields.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 p-4">
        <div className="text-4xl">📊</div>
        <p className="text-sm font-medium">Configure your report to see a preview</p>
        <p className="text-xs text-center">Select a data source and fields on the left, then click Run Preview.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground">{rows.length} records</span>
        {currencyTotals.map(t => (
          <span key={t.label}>{t.label}: <span className="font-semibold text-foreground">{formatCurrency(t.sum)}</span></span>
        ))}
        {totalRows != null && totalRows > rows.length && (
          <span className="ml-auto text-amber-600">Preview — {rows.length} of {totalRows} rows</span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 p-8">
          <div className="text-3xl">🔍</div>
          <p className="text-sm">No records match your filter criteria.</p>
          <p className="text-xs">Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs min-w-max">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr>
                  {selectedFields.map(f => (
                    <th key={f.key} className="text-left p-2.5 font-semibold text-muted-foreground border-b whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {f.key.startsWith(CALC_FIELD_PREFIX) && (
                          <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-mono">ƒ</span>
                        )}
                        {f.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, ridx) => (
                  <tr key={row.id || ridx} className={`border-b last:border-0 ${ridx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    {selectedFields.map(f => (
                      <td
                        key={f.key}
                        className={`p-2.5 ${f.key.startsWith(CALC_FIELD_PREFIX) ? 'bg-purple-50/50' : ''}`}
                      >
                        {formatCell(f.key, row[f.key], f.label)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t bg-card text-xs">
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages} ({PAGE_SIZE * page + 1}–{Math.min(PAGE_SIZE * (page + 1), rows.length)} of {rows.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40"
                ><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40"
                ><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}