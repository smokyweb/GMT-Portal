import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { BudgetAmendmentReviewDialog } from '../components/BudgetAmendmentReview';
import { CheckCircle2, XCircle, Clock, FileEdit, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import moment from 'moment';

const STATUS_CONFIG = {
  Draft:             { bg: 'bg-slate-100', text: 'text-slate-700', icon: Clock, label: 'Draft' },
  Submitted:         { bg: 'bg-blue-100',  text: 'text-blue-700',  icon: FileEdit, label: 'Submitted' },
  UnderReview:       { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Under Review' },
  Approved:          { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Approved' },
  Denied:            { bg: 'bg-red-100',   text: 'text-red-700',   icon: XCircle, label: 'Denied' },
  RevisionRequested: { bg: 'bg-orange-100',text: 'text-orange-700',icon: FileEdit, label: 'Revision Requested' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

function KPICard({ label, value, sub, colorClass = 'text-foreground' }) {
  return (
    <div className="bg-card border rounded-xl p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function buildChartData(amendments) {
  const byMonth = {};
  for (const am of amendments) {
    const month = moment(am.submitted_at || am.created_date).format('MMM YYYY');
    if (!byMonth[month]) byMonth[month] = { month, requested: 0, approved: 0 };
    byMonth[month].requested += am.net_change || 0;
    if (am.status === 'Approved') byMonth[month].approved += am.net_change || 0;
  }
  // Sort chronologically, last 12 months
  return Object.values(byMonth)
    .sort((a, b) => moment(a.month, 'MMM YYYY') - moment(b.month, 'MMM YYYY'))
    .slice(-12);
}

export default function BudgetAmendmentsDashboard() {
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    const [data, u] = await Promise.all([
      base44.entities.BudgetAmendment.list('-created_date', 200),
      base44.auth.me(),
    ]);

    let filtered = data;
    if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
      if (u.role === 'admin' && u.scope_state) {
        // State admin: filter to their state's organizations
        const orgs = await base44.entities.Organization.list();
        const stateOrgIds = new Set(orgs.filter(o => o.state === u.scope_state).map(o => o.id));
        filtered = data.filter(ba => stateOrgIds.has(ba.organization_id));
      } else if (u.role === 'user' && u.organization_id) {
        // Subrecipient: filter to their organization only
        filtered = data.filter(ba => ba.organization_id === u.organization_id);
      }
    }

    setAmendments(filtered);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = amendments.filter(am => {
    if (filterStatus !== 'all' && am.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !am.organization_name?.toLowerCase().includes(q) &&
        !am.application_number?.toLowerCase().includes(q) &&
        !am.amendment_number?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const pending = amendments.filter(a => ['Submitted', 'UnderReview'].includes(a.status));
  const approved = amendments.filter(a => a.status === 'Approved');
  const denied = amendments.filter(a => a.status === 'Denied');
  const totalNetApproved = approved.reduce((s, a) => s + (a.net_change || 0), 0);

  const chartData = buildChartData(amendments);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget Amendments</h1>
        <p className="text-muted-foreground text-sm mt-1">All amendment requests across applications</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard label="Pending Review" value={pending.length} colorClass="text-amber-600" sub="Submitted or under review" />
        <KPICard label="Approved" value={approved.length} colorClass="text-green-600" sub={`Net change: ${formatCurrency(totalNetApproved)}`} />
        <KPICard label="Denied" value={denied.length} colorClass="text-red-600" />
        <KPICard label="Total Amendments" value={amendments.length} />
      </div>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Monthly Amendment Net Change (Requested vs. Approved)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => { const n = Math.abs(v); if (n >= 1000000) return `$${(v/1000000).toFixed(1)}M`; if (n >= 1000) return `$${(v/1000).toFixed(0)}k`; return `$${v}`; }} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(val) => formatCurrency(val)} />
              <Legend />
              <Bar dataKey="requested" name="Requested Net Change" fill="hsl(var(--chart-3))" radius={[3,3,0,0]} />
              <Bar dataKey="approved" name="Approved Net Change" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-64"
          placeholder="Search org, app #, or amendment #..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_CONFIG).map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Amendment #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Current Budget</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Proposed</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Net Change</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(am => (
                <tr key={am.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-mono text-xs font-semibold">{am.amendment_number || '””'}</td>
                  <td className="p-3 font-medium">{am.organization_name || '””'}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{am.application_number || '””'}</td>
                  <td className="p-3 text-right">{formatCurrency(am.original_total)}</td>
                  <td className="p-3 text-right font-medium text-blue-700">{formatCurrency(am.proposed_total)}</td>
                  <td className={`p-3 text-right font-semibold ${(am.net_change || 0) > 0 ? 'text-amber-700' : (am.net_change || 0) < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {(am.net_change || 0) >= 0 ? '+' : ''}{formatCurrency(am.net_change || 0)}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(am.submitted_at)}</td>
                  <td className="p-3"><StatusBadge status={am.status} /></td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelected(am)}>
                      {['Submitted', 'UnderReview'].includes(am.status) ? 'Review' : 'View'}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No amendments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BudgetAmendmentReviewDialog
        amendment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onActioned={() => { setSelected(null); load(); }}
        isAdmin={true}
      />
    </div>
  );
}