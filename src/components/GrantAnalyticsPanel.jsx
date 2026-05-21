import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingUp, Award, BarChart2, Filter, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

const CATEGORY_COLORS = {
  Personnel:    '#3b82f6',
  Equipment:    '#8b5cf6',
  Training:     '#10b981',
  Travel:       '#f59e0b',
  Contractual:  '#ef4444',
  Planning:     '#06b6d4',
  Other:        '#64748b',
};

function KPI({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyChart({ height = 160 }) {
  return (
    <div className={`flex items-center justify-center text-muted-foreground text-sm`} style={{ height }}>
      No data yet
    </div>
  );
}

/**
 * GrantAnalyticsPanel
 *
 * Props:
 *   organizationId  — if provided, scope to a single org (subrecipient view)
 *                     if null/undefined, show portfolio-wide view (state admin)
 */
function fyMatch(app, fy) {
  if (fy === 'All') return true;
  const year = fy.replace('FY', '');
  return (app.performance_start || '').startsWith(year) || (app.performance_end || '').startsWith(year);
}

function deriveFyOptions(apps) {
  const years = new Set();
  apps.forEach(a => {
    ['performance_start', 'performance_end'].forEach(field => {
      const val = a[field];
      if (val) { const yr = parseInt(val.slice(0, 4), 10); if (yr >= 2020 && yr <= 2040) years.add(yr); }
    });
  });
  const now = new Date().getFullYear();
  years.add(now); years.add(now + 1);
  return ['All', ...[...years].sort((a, b) => b - a).map(y => `FY${y}`)];
}

function FilterBar({ filters, setFilters, programs, nofos, grants, isStateView, fyOptions }) {
  const hasActive = Object.values(filters).some(v => v !== 'All');

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-xl border mb-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

      <Select value={filters.fy} onValueChange={v => setFilters(f => ({ ...f, fy: v }))}>
        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Fiscal Year" /></SelectTrigger>
        <SelectContent>{fyOptions.map(y => <SelectItem key={y} value={y}>{y === 'All' ? 'All Years' : y}</SelectItem>)}</SelectContent>
      </Select>

      {isStateView && (
        <Select value={filters.program} onValueChange={v => setFilters(f => ({ ...f, program: v }))}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Program" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.nofo} onValueChange={v => setFilters(f => ({ ...f, nofo: v }))}>
        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="NOFO" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All NOFOs</SelectItem>
          {nofos.map(n => <SelectItem key={n} value={n}>{n.length > 32 ? n.slice(0, 32) + '…' : n}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.grant} onValueChange={v => setFilters(f => ({ ...f, grant: v }))}>
        <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Grant" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Grants</SelectItem>
          {grants.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {['All', 'Draft', 'Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested', 'Approved', 'Denied'].map(s => (
            <SelectItem key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActive && (
        <button
          onClick={() => setFilters({ fy: 'All', program: 'All', nofo: 'All', grant: 'All', status: 'All' })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition ml-1"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

export default function GrantAnalyticsPanel({ organizationId, filteredAppIds, externalFilters, setExternalFilters }) {
  const [apps, setApps] = useState([]);
  const [fundingReqs, setFundingReqs] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [internalFilters, setInternalFilters] = useState({ fy: 'All', program: 'All', nofo: 'All', grant: 'All', status: 'All' });
  // Use external filters (shared with dashboard) if provided, otherwise use internal
  const filters = externalFilters ? { ...externalFilters, grant: externalFilters.grant || 'All' } : internalFilters;
  const setFilters = externalFilters ? (updater) => {
    const next = typeof updater === 'function' ? updater(filters) : updater;
    // Only push back the fields the parent DashboardFilterBar knows about
    setExternalFilters(f => ({ ...f, fy: next.fy, program: next.program, nofo: next.nofo, status: next.status }));
    setInternalFilters(next);
  } : setInternalFilters;

  useEffect(() => {
    Promise.all([
      organizationId
        ? base44.entities.Application.filter({ organization_id: organizationId }, '-created_date', 100)
        : base44.entities.Application.list('-created_date', 200),
      organizationId
        ? base44.entities.FundingRequest.filter({ organization_id: organizationId }, '-created_date', 200)
        : base44.entities.FundingRequest.list('-created_date', 200),
      base44.entities.ApplicationBudget.list('-created_date', 500),
    ]).then(([a, fr, b]) => {
      setApps(a);
      setFundingReqs(fr);
      setBudgets(b);
      setLoading(false);
    });
  }, [organizationId]);

  // ── Filter option derivations ─────────────────────────────────────────────
  const programs  = useMemo(() => [...new Set(apps.map(a => a.program_code).filter(Boolean))].sort(), [apps]);
  const nofos     = useMemo(() => [...new Set(apps.map(a => a.nofo_title).filter(Boolean))].sort(), [apps]);
  const fyOptions = useMemo(() => deriveFyOptions(apps), [apps]);
  const grants    = useMemo(() =>
    apps.filter(a => a.status === 'Approved').map(a => ({
      id: a.id,
      label: `${a.application_number || a.project_title || a.id}`,
    })), [apps]);

  // ── Apply filters to apps (also respect parent filteredAppIds if passed) ──
  const filteredApps = useMemo(() => apps.filter(a => {
    if (filteredAppIds && !filteredAppIds.has(a.id)) return false;
    if (!fyMatch(a, filters.fy)) return false;
    if (filters.program !== 'All' && a.program_code !== filters.program) return false;
    if (filters.nofo !== 'All' && a.nofo_title !== filters.nofo) return false;
    if (filters.grant !== 'All' && a.id !== filters.grant) return false;
    if (filters.status !== 'All' && a.status !== filters.status) return false;
    return true;
  }), [apps, filters]);

  // ── Apply filters to funding requests (via app ids) ───────────────────────
  const filteredIds = useMemo(() => new Set(filteredApps.map(a => a.id)), [filteredApps]);
  const filteredFRs = useMemo(() =>
    fundingReqs.filter(r => filteredIds.has(r.application_id)), [fundingReqs, filteredIds]);

  // ── KPI metrics ──────────────────────────────────────────────────────────
  const approvedApps   = useMemo(() => filteredApps.filter(a => a.status === 'Approved'), [filteredApps]);
  const totalAwarded   = useMemo(() => approvedApps.reduce((s, a) => s + (a.awarded_amount || 0), 0), [approvedApps]);
  const totalExpended  = useMemo(() => approvedApps.reduce((s, a) => s + (a.total_expended || 0), 0), [approvedApps]);
  const totalRemaining = useMemo(() => approvedApps.reduce((s, a) => s + (a.remaining_balance || 0), 0), [approvedApps]);
  const avgUtilization = useMemo(() => {
    const rates = approvedApps.filter(a => a.expenditure_rate > 0).map(a => a.expenditure_rate);
    return rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0;
  }, [approvedApps]);

  // ── Chart 1: Spent vs Awarded (by grant / program) ─────────────────────
  const spentVsAwardedData = useMemo(() => {
    if (organizationId) {
      // Per-grant view for subrecipient
      return approvedApps.slice(0, 8).map(a => ({
        name: a.application_number || a.project_title?.slice(0, 12) || '—',
        Awarded:  a.awarded_amount || 0,
        Expended: a.total_expended || 0,
      }));
    }
    // By program for state admin
    const map = {};
    approvedApps.forEach(a => {
      const code = a.program_code || 'Other';
      if (!map[code]) map[code] = { name: code, Awarded: 0, Expended: 0 };
      map[code].Awarded  += a.awarded_amount  || 0;
      map[code].Expended += a.total_expended  || 0;
    });
    return Object.values(map);
  }, [approvedApps, organizationId]);

  // ── Chart 2: Expenditure trend over time ─────────────────────────────────
  const trendData = useMemo(() => {
    const months = {};
    filteredFRs.forEach(r => {
      if (!r.period_end || r.status !== 'Approved') return;
      const d = new Date(r.period_end);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!months[key]) months[key] = { key, label, Requested: 0, Approved: 0 };
      months[key].Requested += r.amount_requested || 0;
      months[key].Approved  += r.amount_approved  || 0;
    });
    return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
  }, [fundingReqs]);

  // ── Chart 3: Budget utilization by category ───────────────────────────────
  const categoryData = useMemo(() => {
    const appIds = new Set(approvedApps.map(a => a.id));
    const map = {};
    budgets.filter(b => appIds.has(b.application_id)).forEach(b => {
      const cat = b.budget_category || 'Other';
      if (!map[cat]) map[cat] = { name: cat, Budgeted: 0 };
      map[cat].Budgeted += b.amount_requested || 0;
    });
    return Object.values(map).sort((a, b) => b.Budgeted - a.Budgeted);
  }, [budgets, approvedApps]);

  // ── Chart 4: Funding request status breakdown (pie) ───────────────────────
  const frStatusData = useMemo(() => {
    const map = {};
    filteredFRs.forEach(r => {
      map[r.status] = (map[r.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fundingReqs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== 'All').length;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        programs={programs}
        nofos={nofos}
        grants={grants}
        isStateView={!organizationId}
        fyOptions={fyOptions}
      />

      {activeFilterCount > 0 && (
        <p className="text-xs text-muted-foreground -mt-3">
          Showing filtered results · {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''} matched
        </p>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Awarded"     value={formatCurrency(totalAwarded)}   icon={DollarSign}  color="bg-blue-500" />
        <KPI label="Total Expended"    value={formatCurrency(totalExpended)}   icon={TrendingUp}  color="bg-emerald-500" />
        <KPI label="Remaining Balance" value={formatCurrency(totalRemaining)}  icon={Award}       color="bg-purple-500" />
        <KPI label="Avg. Utilization"  value={`${avgUtilization}%`}
             sub={`across ${approvedApps.length} active grant${approvedApps.length !== 1 ? 's' : ''}`}
             icon={BarChart2}  color="bg-amber-500" />
      </div>

      {/* Row 1: Spent vs Awarded + Trend */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Spent vs Awarded */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-1">
            {organizationId ? 'Awarded vs. Expended — Per Grant' : 'Awarded vs. Expended — By Program'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Compares total awarded funding against dollars spent</p>
          {spentVsAwardedData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spentVsAwardedData} margin={{ top: 4, right: 8, left: 0, bottom: organizationId ? 20 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={organizationId ? -20 : 0} textAnchor={organizationId ? 'end' : 'middle'} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Awarded"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expended" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expenditure Trend */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-1">Expenditure Trend Over Time</h3>
          <p className="text-xs text-muted-foreground mb-4">Approved reimbursements by month</p>
          {trendData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Requested" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Approved"  stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Budget by Category + FR Status */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Budget utilization by category */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-1">Budget by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">Approved grant budgets broken down by spending category</p>
          {categoryData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 24, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={68} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="Budgeted" radius={[0, 3, 3, 0]}>
                  {categoryData.map(entry => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Funding Request Status Pie */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-1">Funding Requests by Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution of all {organizationId ? 'your' : 'portfolio'} funding requests</p>
          {frStatusData.length === 0 ? <EmptyChart /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={frStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {frStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {frStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="text-xs font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}