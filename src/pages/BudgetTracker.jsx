import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingUp, DollarSign, CheckCircle2, Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { paidLineActuals } from '../lib/fundingMetrics';

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
  const [fundingRequests, setFundingRequests] = useState([]);
  const [paidActualsByLine, setPaidActualsByLine] = useState(new Map());
  const [paidMatchActualsByLine, setPaidMatchActualsByLine] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [lineLoading, setLineLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      let appList = [];
      if (u?.organization_id) {
        // Subrecipient: filter to their org
        appList = await base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date');
      } else if (['admin','reviewer','isc_admin','federal_admin'].includes(u?.role)) {
        // The entity API applies state scope before limiting approved grants.
        appList = await base44.entities.Application.filter({ status: 'Approved' }, '-created_date');
      }
      setApps(appList);
      if (appList.length > 0) setSelectedAppId(appList[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedAppId) return;
    let active = true;
    loadLineData(selectedAppId, () => active);
    return () => { active = false; };
  }, [selectedAppId]);

  const loadLineData = async (appId, isActive) => {
    setLineLoading(true);
    const [budgets, fundingRequests] = await Promise.all([
      base44.entities.ApplicationBudget.filter({ application_id: appId }),
      base44.entities.FundingRequest.filter({ application_id: appId, payment_status: 'Paid' }),
    ]);

    const paidRequestIds = fundingRequests.map(request => request.id);
    const relevantLines = paidRequestIds.length
      ? await base44.entities.FundingRequestLineItem.filter({ funding_request_id: paidRequestIds })
      : [];
    if (!isActive()) return;
    setExpenditures(relevantLines);
    setFundingRequests(fundingRequests);
    setPaidActualsByLine(paidLineActuals(fundingRequests, relevantLines));
    setPaidMatchActualsByLine(new Map(relevantLines.map(l => [l.id, Number(l.amount_match) || 0])));
    setBudgetLines(budgets);
    setLineLoading(false);
  };

  // Aggregate actuals to the exact imported budget line first. Falling back
  // to category is retained only for older lines that predate the mapping.
  const getActualsByBudget = () => {
    const byBudget = {};
    const byCategory = {};
    const matchByBudget = {};
    const matchByCategory = {};
    expenditures.forEach(l => {
      const actual = paidActualsByLine.get(l.id) || 0;
      const matchActual = paidMatchActualsByLine.get(l.id) || 0;
      if (l.application_budget_id) byBudget[l.application_budget_id] = (byBudget[l.application_budget_id] || 0) + actual;
      if (l.application_budget_id) matchByBudget[l.application_budget_id] = (matchByBudget[l.application_budget_id] || 0) + matchActual;
      const cat = l.budget_category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + actual;
      matchByCategory[cat] = (matchByCategory[cat] || 0) + matchActual;
    });
    return { byBudget, byCategory, matchByBudget, matchByCategory };
  };

  const selectedApp = apps.find(a => a.id === selectedAppId);
  const { byBudget: actualsByBudget, byCategory: actualsByCategory, matchByBudget: matchActualsByBudget, matchByCategory: matchActualsByCategory } = getActualsByBudget();

  // Build merged rows per category
  const categoryRows = budgetLines.map(b => {
    const budgeted = b.amount_requested || 0;
    const actual = b.id && actualsByBudget[b.id] !== undefined
      ? actualsByBudget[b.id]
      : actualsByCategory[b.budget_category] || 0;
    const matchActual = b.id && matchActualsByBudget[b.id] !== undefined
      ? matchActualsByBudget[b.id]
      : matchActualsByCategory[b.budget_category] || 0;
    const matchBudgeted = Number(b.amount_match) || 0;
    const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0;
    const warning = pct >= 90 && pct < 100;
    const over = pct > 100;
    return { ...b, actual, matchActual, matchBudgeted, pct, warning, over };
  });

  // Totals
  const totalBudgeted = categoryRows.reduce((s, r) => s + (Number(r.amount_requested) || 0), 0);
  const totalActual = categoryRows.reduce((s, r) => s + r.actual, 0);
  const totalMatchBudgeted = categoryRows.reduce((s, r) => s + r.matchBudgeted, 0);
  const totalMatchActual = categoryRows.reduce((s, r) => s + r.matchActual, 0);
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;
  const totalWarning = totalPct >= 90 && totalPct < 100;
  const totalOver = totalPct > 100;

  const warnings = categoryRows.filter(r => r.warning || r.over);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Note: admins don't have organization_id but can still see apps by state scope - don't block here

  const filteredCategoryRows = categoryRows.filter(r =>
    !categorySearch || r.budget_category?.toLowerCase().includes(categorySearch.toLowerCase()) ||
    r.line_description?.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Budget Tracker</h1>
        <p className="text-muted-foreground text-sm mt-1">Budget vs. actual expenditures per line item</p>
      </div>

      {/* Grant Selector - dropdown for scalability */}
       {apps.length > 0 && (
         <>
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium text-muted-foreground">Select Grant ({apps.length} available)</label>
             <Select value={selectedAppId} onValueChange={setSelectedAppId}>
               <SelectTrigger className="max-w-xl">
                 <SelectValue placeholder="Select a grant..." />
               </SelectTrigger>
               <SelectContent className="max-h-64 overflow-y-auto">
                 {apps.map(a => (
                   <SelectItem key={a.id} value={a.id}>
                     <span className="flex items-center gap-2">
                       {a.application_number}{a.project_title ? ` - ${a.project_title}` : ''}
                       <span className="text-xs opacity-60">({a.program_code}{a.expenditure_rate ? ` · ${Math.round(Number(a.expenditure_rate))}%` : ''})</span>
                     </span>
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         </>
       )}

      {apps.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active grants found.</p>
          <p className="text-sm mt-1">Budget tracking is available once a grant application has been submitted or approved.</p>
        </div>
      ) : selectedAppId && (
        <>
          {/* Grant summary header */}
          {selectedApp && (
            <div className="bg-card border rounded-xl p-4 flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Grant</p>
                <p className="font-semibold">{selectedApp.application_number}{selectedApp.project_title ? ` - ${selectedApp.project_title}` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Program</p>
                <p className="font-semibold">{selectedApp.program_code || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Grant Amount</p>
                <p className="font-semibold">{formatCurrency(selectedApp.requested_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Match Amount</p>
                <p className="font-semibold">{formatCurrency(selectedApp.match_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Awarded</p>
                <p className="font-semibold text-green-700">{formatCurrency(selectedApp.awarded_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Performance Period</p>
                <p className="font-semibold">{selectedApp.performance_start ? selectedApp.performance_start.substring(0,10) : '-'} &ndash; {selectedApp.performance_end ? selectedApp.performance_end.substring(0,10) : '-'}</p>
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
                      ? ` is over budget "" ${formatCurrency(r.actual)} spent of ${formatCurrency(r.amount_requested)} budgeted (${r.pct.toFixed(1)}%)`
                      : ` is ${r.pct.toFixed(1)}% spent "" only ${formatCurrency(r.amount_requested - r.actual)} remaining`
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
            <p className="text-xs text-muted-foreground">
              {totalActual > 0 ? formatCurrency(totalActual) : '$0'} of {formatCurrency(totalBudgeted)}
              {totalPct > 0 && totalActual === 0 && selectedApp?.total_expended ? ` (${formatCurrency(Number(selectedApp.total_expended))} per grant record)` : ''}
            </p>
          </div>

          {/* Line items vs grant-level expended mismatch */}
          {selectedApp?.total_expended && Number(selectedApp.total_expended) > 0 && totalActual === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm flex items-start gap-2">
              <div className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5">ℹ</div>
              <div>
                <p className="font-semibold text-blue-800">Note: Grant-Level Expenditure</p>
                <p className="text-blue-700 text-xs mt-0.5">
                  The grant record shows {formatCurrency(Number(selectedApp.total_expended))} expended, but the funding request line items don't have category-level detail.
                  Submit funding requests with itemized budget categories to see the breakdown here.
                </p>
              </div>
            </div>
          )}

          {/* Amendment alert - show if awarded amount differs from budgeted total */}
          {selectedApp?.awarded_amount && Math.abs(Number(selectedApp.awarded_amount) - totalBudgeted) > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Budget Mismatch</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Awarded amount ({formatCurrency(Number(selectedApp.awarded_amount))}) differs from budget line total ({formatCurrency(totalBudgeted)}).
                  Budget amendments may have changed the award. Review the Amendments tab to reconcile.
                </p>
              </div>
            </div>
          )}

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
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                <p className="font-semibold text-sm">Budget by Category</p>
                {categoryRows.length > 3 && (
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-xs w-52"
                      placeholder="Filter categories..."
                      value={categorySearch}
                      onChange={e => setCategorySearch(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="divide-y">
                {filteredCategoryRows.map(row => (
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
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Federal budget</p>
                          <p className="text-sm font-semibold">{formatCurrency(row.amount_requested)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Federal paid</p>
                          <p className={`text-sm font-semibold ${row.over ? 'text-red-600' : ''}`}>{formatCurrency(row.actual)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Match budget</p>
                          <p className="text-sm font-semibold">{formatCurrency(row.matchBudgeted)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Match paid</p>
                          <p className="text-sm font-semibold">{formatCurrency(row.matchActual)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Federal remaining</p>
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
              {/* Grand total row "" only when not filtered */}
              {!categorySearch && (
                <div className={`px-4 py-3 border-t font-semibold flex items-center justify-between
                  ${totalOver ? 'bg-red-50' : totalWarning ? 'bg-amber-50' : 'bg-muted/30'}`}>
                  <span className="text-sm">Total</span>
                  <div className="flex gap-6 text-right text-sm">
                    <span>{formatCurrency(totalBudgeted)}</span>
                    <span className={totalOver ? 'text-red-600' : ''}>{formatCurrency(totalActual)}</span>
                    <span>{formatCurrency(totalMatchBudgeted)}</span>
                    <span>{formatCurrency(totalMatchActual)}</span>
                    <span className={totalOver ? 'text-red-600' : 'text-green-700'}>{formatCurrency(totalBudgeted - totalActual)}</span>
                  </div>
                </div>
              )}
              {categorySearch && filteredCategoryRows.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">No categories match your search.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
