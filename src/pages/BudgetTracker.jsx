import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';

const CATEGORY_COLORS = {
  Personnel:     'bg-blue-500',
  Equipment:     'bg-purple-500',
  Training:      'bg-green-500',
  Travel:        'bg-amber-500',
  Contractual:   'bg-pink-500',
  Planning:      'bg-teal-500',
  Other:         'bg-slate-400',
};

function ProgressBar({ pct, warning, over }) {
  const clampedPct = Math.min(pct, 100);
  const barColor = over ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-12 text-right tabular-nums
        ${over ? 'text-red-600' : warning ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function BudgetTracker() {
  const [user, setUser] = useState(null);
  const [apps, setApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [budgetLines, setBudgetLines] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lineLoading, setLineLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (u?.organization_id) {
        const appList = await base44.entities.Application.filter(
          { organization_id: u.organization_id, status: 'Approved' },
          '-created_date', 50
        );
        setApps(appList);
        if (appList.length > 0) setSelectedAppId(appList[0].id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedAppId) return;
    loadLineData(selectedAppId);
  }, [selectedAppId]);

  const loadLineData = async (appId) => {
    setLineLoading(true);
    const [budgets, frLines, fundingRequests] = await Promise.all([
      base44.entities.ApplicationBudget.filter({ application_id: appId }),
      base44.entities.FundingRequestLineItem.list('-created_date', 500),
      base44.entities.FundingRequest.filter({ application_id: appId }),
    ]);

    // Get approved funding request IDs for this app
    const approvedFRIds = new Set(
      fundingRequests.filter(fr => fr.status === 'Approved').map(fr => fr.id)
    );

    // Filter line items to only approved FRs for this app
    const relevantLines = frLines.filter(l => approvedFRIds.has(l.funding_request_id));
    setExpenditures(relevantLines);
    setBudgetLines(budgets);
    setLineLoading(false);
  };

  // Aggregate actuals per budget category
  const getActualsByCategory = () => {
    const map = {};
    expenditures.forEach(l => {
      const cat = l.budget_category || 'Other';
      map[cat] = (map[cat] || 0) + (l.amount || 0);
    });
    return map;
  };

  const selectedApp = apps.find(a => a.id === selectedAppId);
  const actualsByCategory = getActualsByCategory();

  // Build merged rows per category
  const categoryRows = budgetLines.map(b => {
    const budgeted = b.amount_requested || 0;
    const actual = actualsByCategory[b.budget_category] || 0;
    const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0;
    const warning = pct >= 90 && pct < 100;
    const over = pct >= 100;
    return { ...b, actual, pct, warning, over };
  });

  // Totals
  const totalBudgeted = categoryRows.reduce((s, r) => s + (r.amount_requested || 0), 0);
  const totalActual = categoryRows.reduce((s, r) => s + r.actual, 0);
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
  const totalWarning = totalPct >= 90 && totalPct < 100;
  const totalOver = totalPct >= 100;

  const warnings = categoryRows.filter(r => r.warning || r.over);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user?.organization_id) return (
    <div className="text-center py-16 text-muted-foreground">
      <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No organization linked to your account.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Budget Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Budget vs. actual expenditures per line item</p>
        </div>
        {apps.length > 1 && (
          <Select value={selectedAppId} onValueChange={setSelectedAppId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select grant…" />
            </SelectTrigger>
            <SelectContent>
              {apps.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.application_number || 'Draft'} — {a.project_title || 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {apps.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No approved grants found.</p>
          <p className="text-sm mt-1">Budget tracking is available once a grant application is approved.</p>
        </div>
      ) : (
        <>
          {/* Grant summary header */}
          {selectedApp && (
            <div className="bg-card border rounded-xl p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Grant</p>
                <p className="font-semibold">{selectedApp.application_number} — {selectedApp.project_title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Program</p>
                <p className="font-semibold">{selectedApp.program_code || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Awarded</p>
                <p className="font-semibold text-green-700">{formatCurrency(selectedApp.awarded_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Performance Period</p>
                <p className="font-semibold">{selectedApp.performance_start} – {selectedApp.performance_end}</p>
              </div>
            </div>
          )}

          {/* Automated warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map(r => (
                <div key={r.id} className={`flex items-start gap-3 rounded-lg px-4 py-3 border text-sm
                  ${r.over ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${r.over ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <span className="font-semibold">{r.budget_category}</span>
                    {r.over
                      ? ` is over budget — ${formatCurrency(r.actual)} spent of ${formatCurrency(r.amount_requested)} budgeted (${r.pct.toFixed(1)}%)`
                      : ` is ${r.pct.toFixed(1)}% spent — only ${formatCurrency(r.amount_requested - r.actual)} remaining`
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Total Budgeted</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalBudgeted)}</p>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Total Expended</p>
              <p className={`text-xl font-bold mt-1 ${totalOver ? 'text-red-600' : ''}`}>{formatCurrency(totalActual)}</p>
            </div>
            <div className={`border rounded-xl p-4 ${totalOver ? 'bg-red-50 border-red-200' : totalWarning ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${totalOver ? 'text-red-600' : 'text-green-700'}`}>
                {formatCurrency(totalBudgeted - totalActual)}
              </p>
            </div>
          </div>

          {/* Overall progress */}
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Overall Budget Utilization</p>
              {totalOver
                ? <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Over Budget</span>
                : totalWarning
                  ? <span className="text-xs font-semibold text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Near Limit</span>
                  : <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> On Track</span>
              }
            </div>
            <ProgressBar pct={totalPct} warning={totalWarning} over={totalOver} />
            <p className="text-xs text-muted-foreground">{formatCurrency(totalActual)} of {formatCurrency(totalBudgeted)}</p>
          </div>

          {/* Line items table */}
          {lineLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : budgetLines.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No budget line items found for this grant.</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="font-semibold text-sm">Budget by Category</p>
              </div>
              <div className="divide-y">
                {categoryRows.map(row => (
                  <div key={row.id} className={`p-4 ${row.over ? 'bg-red-50/40' : row.warning ? 'bg-amber-50/40' : ''}`}>
                    <div className="flex items-start justify-between mb-2 gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[row.budget_category] || 'bg-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{row.budget_category}</p>
                          {row.line_description && <p className="text-xs text-muted-foreground truncate">{row.line_description}</p>}
                        </div>
                        {row.over && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                        {row.warning && !row.over && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                      </div>
                      <div className="flex gap-6 text-right flex-shrink-0">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budgeted</p>
                          <p className="text-sm font-semibold">{formatCurrency(row.amount_requested)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expended</p>
                          <p className={`text-sm font-semibold ${row.over ? 'text-red-600' : ''}`}>{formatCurrency(row.actual)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</p>
                          <p className={`text-sm font-semibold ${row.over ? 'text-red-600' : 'text-green-700'}`}>
                            {formatCurrency(row.amount_requested - row.actual)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ProgressBar pct={row.pct} warning={row.warning} over={row.over} />
                  </div>
                ))}
              </div>
              {/* Grand total row */}
              <div className={`px-4 py-3 border-t font-semibold flex items-center justify-between
                ${totalOver ? 'bg-red-50' : totalWarning ? 'bg-amber-50' : 'bg-muted/30'}`}>
                <span className="text-sm">Total</span>
                <div className="flex gap-6 text-right text-sm">
                  <span>{formatCurrency(totalBudgeted)}</span>
                  <span className={totalOver ? 'text-red-600' : ''}>{formatCurrency(totalActual)}</span>
                  <span className={totalOver ? 'text-red-600' : 'text-green-700'}>{formatCurrency(totalBudgeted - totalActual)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}