import { useState, useEffect, useMemo } from 'react';
import { runVarianceScanner } from '../lib/varianceScanner';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, FunnelChart, Funnel, LabelList
} from 'recharts';
import { TrendingUp, DollarSign, Award, AlertTriangle, Filter, ScanSearch, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';

const PROGRAM_COLORS = {
  SHSP: '#3b82f6', UASI: '#8b5cf6', EMPG: '#10b981',
  HSGP: '#f59e0b', NSGP: '#ef4444', SLCGP: '#06b6d4', Other: '#64748b',
};

const STATUS_ORDER = ['Draft', 'Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested', 'Approved', 'Denied'];
const STATUS_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#10b981', '#ef4444'];

const FISCAL_YEARS = ['All', 'FY2025', 'FY2024', 'FY2023'];

export default function Analytics() {
  const [applications, setApplications] = useState([]);
  const [fundingRequests, setFundingRequests] = useState([]);
  const [complianceFlags, setComplianceFlags] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fyFilter, setFyFilter] = useState('All');
  const [programFilter, setProgramFilter] = useState('All');
  const [scanStatus, setScanStatus] = useState(null); // null | 'running' | { scanned, flagged }

  const runScan = async (user) => {
    setScanStatus('running');
    const result = await runVarianceScanner(user);
    setScanStatus(result);
    // Reload compliance flags after scan
    const flags = await base44.entities.ComplianceFlag.list('-created_date', 200);
    setComplianceFlags(flags);
    setTimeout(() => setScanStatus(null), 6000);
  };

  useEffect(() => {
    Promise.all([
      base44.entities.Application.list('-submitted_at', 200),
      base44.entities.FundingRequest.list('-created_date', 200),
      base44.entities.ComplianceFlag.list('-created_date', 200),
      base44.entities.Organization.list(),
      base44.auth.me(),
    ]).then(([apps, reqs, flags, orgs, me]) => {
      setApplications(apps);
      setFundingRequests(reqs);
      setComplianceFlags(flags);
      setOrganizations(orgs);
      setLoading(false);
      // Auto-run variance scan on load
      runScan(me);
    });
  }, []);

  const programs = useMemo(() => {
    const set = new Set(applications.map(a => a.program_code).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [applications]);

  const filtered = useMemo(() => {
    return applications.filter(a => {
      const matchProgram = programFilter === 'All' || a.program_code === programFilter;
      const matchFY = fyFilter === 'All' || (fyFilter === 'FY2025' && a.performance_start?.startsWith('2025'))
        || (fyFilter === 'FY2024' && a.performance_start?.startsWith('2024'))
        || (fyFilter === 'FY2023' && a.performance_start?.startsWith('2023'));
      return matchProgram && matchFY;
    });
  }, [applications, fyFilter, programFilter]);

  // 1. Grant Portfolio Overview — total funds by program
  const portfolioData = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const code = a.program_code || 'Other';
      if (!map[code]) map[code] = { program: code, awarded: 0, requested: 0 };
      map[code].awarded += a.awarded_amount || 0;
      map[code].requested += a.requested_amount || 0;
    });
    return Object.values(map);
  }, [filtered]);

  // 2. Monthly Expenditure Trend
  const trendData = useMemo(() => {
    const months = {};
    fundingRequests.forEach(r => {
      if (!r.period_end) return;
      const d = new Date(r.period_end);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!months[key]) months[key] = { key, label, expended: 0, approved: 0 };
      months[key].expended += r.amount_requested || 0;
      months[key].approved += r.amount_approved || 0;
    });
    return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
  }, [fundingRequests]);

  // 3. County Performance Grid
  const countyData = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const county = a.organization_name || 'Unknown';
      if (!map[county]) map[county] = { org: county, awards: 0, applications: 0, flags: 0, expenditure: 0 };
      map[county].applications += 1;
      map[county].awards += a.awarded_amount || 0;
      map[county].expenditure = a.expenditure_rate || 0;
    });
    complianceFlags.forEach(f => {
      if (!f.is_resolved) {
        const org = f.organization_name || 'Unknown';
        if (map[org]) map[org].flags += 1;
      }
    });
    return Object.values(map);
  }, [filtered, complianceFlags]);

  // 4. Application Pipeline Funnel
  const pipelineData = useMemo(() => {
    const counts = {};
    STATUS_ORDER.forEach(s => { counts[s] = 0; });
    filtered.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return STATUS_ORDER.map((s, i) => ({
      name: s.replace(/([A-Z])/g, ' $1').trim(),
      value: counts[s],
      fill: STATUS_COLORS[i],
    })).filter(d => d.value > 0);
  }, [filtered]);

  const totalAwarded = filtered.reduce((s, a) => s + (a.awarded_amount || 0), 0);
  const totalRequested = filtered.reduce((s, a) => s + (a.requested_amount || 0), 0);
  const totalExpended = filtered.reduce((s, a) => s + (a.total_expended || 0), 0);
  const approvedCount = filtered.filter(a => a.status === 'Approved').length;
  const openFlags = complianceFlags.filter(f => !f.is_resolved).length;

  // County awarded chart
  const orgCountyMap = useMemo(() => {
    const m = {};
    organizations.forEach(o => { m[o.id] = o.county || o.name || 'Unknown'; });
    return m;
  }, [organizations]);

  const countyAwardedData = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const county = orgCountyMap[a.organization_id] || a.organization_name || 'Unknown';
      if (!map[county]) map[county] = { county, awarded: 0, expended: 0 };
      map[county].awarded += a.awarded_amount || 0;
      map[county].expended += a.total_expended || 0;
    });
    return Object.values(map).sort((a, b) => b.awarded - a.awarded).slice(0, 10);
  }, [filtered, orgCountyMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">Grant portfolio performance and pipeline insights</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Scan status indicator */}
          {scanStatus === 'running' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              Running variance scan…
            </span>
          )}
          {scanStatus && scanStatus !== 'running' && (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Scan complete — {scanStatus.flagged} new flag{scanStatus.flagged !== 1 ? 's' : ''} ({scanStatus.scanned} grants checked)
            </span>
          )}
          <button
            onClick={() => base44.auth.me().then(me => runScan(me))}
            disabled={scanStatus === 'running'}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 disabled:opacity-50 transition"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Run Variance Scan
          </button>
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={fyFilter} onValueChange={setFyFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FISCAL_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Awarded', value: formatCurrency(totalAwarded), icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Requested', value: formatCurrency(totalRequested), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Expended', value: formatCurrency(totalExpended), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Approved Grants', value: approvedCount, icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Open Flags', value: openFlags, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className="bg-card rounded-lg border p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon className={`h-5 w-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Portfolio Overview + Pipeline */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Grant Portfolio Overview */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Grant Portfolio Overview — Funds by Program</h2>
          {portfolioData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={portfolioData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="program" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="awarded" name="Awarded" radius={[3, 3, 0, 0]}>
                  {portfolioData.map((entry) => (
                    <Cell key={entry.program} fill={PROGRAM_COLORS[entry.program] || '#64748b'} />
                  ))}
                </Bar>
                <Bar dataKey="requested" name="Requested" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Application Pipeline */}
        <div className="bg-card rounded-lg border p-5">
          <h2 className="text-sm font-semibold mb-4">Application Pipeline — Count by Status</h2>
          {pipelineData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <div className="space-y-2 mt-2">
              {pipelineData.map((d) => {
                const max = Math.max(...pipelineData.map(x => x.value));
                const pct = max > 0 ? (d.value / max) * 100 : 0;
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0">{d.name}</span>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full rounded flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: d.fill }}
                      >
                        <span className="text-white text-xs font-semibold">{d.value}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Monthly Expenditure Trend */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="text-sm font-semibold mb-4">Monthly Expenditure Trend</h2>
        {trendData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No expenditure data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="expended" name="Amount Requested" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="approved" name="Amount Approved" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 3: Funds Awarded by County */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="text-sm font-semibold mb-4">Funds Awarded by County (Top 10)</h2>
        {countyAwardedData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={countyAwardedData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="county" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="awarded" name="Awarded" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expended" name="Expended" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 4: Organization Performance Grid */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="text-sm font-semibold mb-4">Organization Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Organization</th>
                <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Applications</th>
                <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Total Awarded</th>
                <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Expenditure Rate</th>
                <th className="text-right py-2 pl-4 text-xs text-muted-foreground font-medium">Open Flags</th>
              </tr>
            </thead>
            <tbody>
              {countyData.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No data</td></tr>
              ) : countyData.map((row) => {
                const pct = Math.min(100, row.expenditure || 0);
                const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary';
                return (
                  <tr key={row.org} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 pr-4 font-medium">{row.org}</td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{row.applications}</td>
                    <td className="text-right py-3 px-4 font-medium">{row.awards > 0 ? formatCurrency(row.awards) : '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-right py-3 pl-4">
                      {row.flags > 0
                        ? <span className="inline-flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="h-3 w-3" />{row.flags}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}