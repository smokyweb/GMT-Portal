import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';
import { DollarSign, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../lib/helpers';

// Compact currency formatter for KPI cards
const fmtCompact = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n);
};

const PROGRAM_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

const fmt = (v) => { const n = Number(v) || 0; if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (n >= 1_000) return `$${(n/1_000).toFixed(0)}K`; return `$${n}`; };



const PAYMENT_LABELS = {
  PendingDisbursement: { label: 'Pending Disbursement', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  SubmittedToFinance:  { label: 'Submitted to Finance', bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  Paid:                { label: 'Paid',                  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  PaymentFailed:       { label: 'Payment Failed',        bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
};

function KPICard({ label, value, sub, icon: IconComp, accent }) {
  return (
    <div className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${accent || ''}`}>
      {IconComp && <div className="mt-0.5 p-2 rounded-lg bg-muted"><IconComp className="h-4 w-4 text-muted-foreground" /></div>}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PaymentBadge({ status }) {
  if (!status) return <span className="text-xs text-muted-foreground">-</span>;
  const cfg = PAYMENT_LABELS[status] || PAYMENT_LABELS.PendingDisbursement;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function FinancialReporting() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  const loadData = async () => {
    try {
      const me = await base44.auth.me().catch(() => null);
      const data = await base44.entities.FundingRequest.list('-created_date', 500);
      let filtered = (data || []).filter(r => r.status === 'Approved');
      // Scope to state admin's orgs
      if (me?.scope_state && ['admin','reviewer'].includes(me.role)) {
        const orgs = await base44.entities.Organization.filter({ state: me.scope_state }).catch(() => []);
        const orgIds = new Set((orgs || []).map(o => o.id));
        filtered = filtered.filter(r => orgIds.has(r.organization_id));
      } else if (me?.role === 'user' && me?.organization_id) {
        filtered = filtered.filter(r => r.organization_id === me.organization_id);
      }
      setRequests(filtered);
    } catch (err) {
      console.error('FinancialReporting load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const programs = useMemo(() =>
    [...new Set(requests.map(r => r.program_code).filter(Boolean))].sort(), [requests]);

  const filtered = useMemo(() => requests.filter(r => {
    const matchProg = filterProgram === 'all' || r.program_code === filterProgram;
    const matchPay = filterPayment === 'all' || (r.payment_status || 'PendingDisbursement') === filterPayment;
    return matchProg && matchPay;
  }), [requests, filterProgram, filterPayment]);

  // KPIs "" all use amount_approved as the base amount
  // Total Approved = sum of all approved FR amounts
  const totalApproved = filtered.reduce((s, r) => s + (Number(r.amount_approved) || 0), 0);
  // Total Paid = sum where payment_status is Paid
  const totalPaid = filtered.filter(r => r.payment_status === 'Paid').reduce((s, r) => s + (Number(r.amount_approved) || 0), 0);
  // Pending Disbursement = Total Approved minus Total Paid (includes SubmittedToFinance + PendingDisbursement)
  const totalPending = totalApproved - totalPaid;
  // Payment Failed = sum of failed payment amounts
  const totalFailed = filtered.filter(r => r.payment_status === 'PaymentFailed').reduce((s, r) => s + (Number(r.amount_approved) || 0), 0);

  // Approved vs Paid by Program
  const programChartData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const p = r.program_code || 'Unknown';
      if (!map[p]) map[p] = { program: p, approved: 0, paid: 0, submittedToFinance: 0 };
      map[p].approved += Number(r.amount_approved) || 0;
      if (r.payment_status === 'Paid') map[p].paid += Number(r.amount_approved) || 0;
      if (r.payment_status === 'SubmittedToFinance') map[p].submittedToFinance += Number(r.amount_approved) || 0;
    });
    return Object.values(map).sort((a, b) => b.approved - a.approved);
  }, [filtered]);

  // Remaining Balance by Organization
  const orgTableData = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const org = r.organization_name || 'Unknown';
      if (!map[org]) map[org] = { org, approved: 0, paid: 0, count: 0 };
      map[org].approved += Number(r.amount_approved) || 0;
      if (r.payment_status === 'Paid') map[org].paid += Number(r.amount_approved) || 0;
      map[org].count += 1;
    });
    return Object.values(map)
      .map(d => ({ ...d, remaining: d.approved - d.paid }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [filtered]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financial Reporting</h1>
          <p className="text-muted-foreground text-sm mt-1">Track approved funding requests, off-portal payments, and spending trends</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={loadData} className="h-9 px-3 rounded-md border border-input bg-transparent text-sm hover:bg-muted/50 flex items-center gap-1.5" title="Refresh data">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
          <select
            value={filterProgram}
            onChange={e => setFilterProgram(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Payment Statuses</option>
            <option value="PendingDisbursement">Pending Disbursement</option>
            <option value="SubmittedToFinance">Submitted to Finance</option>
            <option value="Paid">Paid</option>
            <option value="PaymentFailed">Payment Failed</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Approved" value={fmtCompact(totalApproved)} sub={`${filtered.length} approved requests`} icon={DollarSign} />
        <KPICard label="Total Paid" value={fmtCompact(totalPaid)} sub={`${filtered.filter(r => r.payment_status === 'Paid').length} requests disbursed`} icon={CheckCircle} accent="border-green-200" />
        <KPICard label="Pending Disbursement" value={fmtCompact(totalPending)} sub={`Approved minus paid (${filtered.filter(r => r.payment_status !== 'Paid').length} unpaid)`} icon={Clock} accent="border-slate-200" />
        <KPICard label="Payment Failed" value={fmtCompact(totalFailed)} sub={`${filtered.filter(r => r.payment_status === 'PaymentFailed').length} requests`} icon={AlertCircle} accent={totalFailed > 0 ? 'border-red-200 bg-red-50/30' : ''} />
      </div>

      {/* Approved vs Paid by Program */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Approved vs. Paid by Program</h2>
        <p className="text-xs text-muted-foreground mb-4">Compares total approved amounts against confirmed off-portal payments</p>
        {programChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={programChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="program" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="approved" name="Approved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="submittedToFinance" name="Submitted to Finance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No approved funding request data yet.</div>
        )}
      </div>

      {/* Remaining Balance by Organization */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Remaining Balance by Organization</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Approved amount minus confirmed payments</p>
          </div>
          <span className="text-xs text-muted-foreground">{orgTableData.length} organizations</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Requests</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total Approved</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total Paid</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Remaining Balance</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-40">Payment Progress</th>
              </tr>
            </thead>
            <tbody>
              {orgTableData.map((row, i) => {
                const paidPct = row.approved > 0 ? Math.round((row.paid / row.approved) * 100) : 0;
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition">
                    <td className="p-3 font-medium">{row.org}</td>
                    <td className="p-3 text-right text-muted-foreground">{row.count}</td>
                    <td className="p-3 text-right">{formatCurrency(row.approved)}</td>
                    <td className="p-3 text-right text-green-700 font-medium">{formatCurrency(row.paid)}</td>
                    <td className="p-3 text-right font-semibold">{formatCurrency(row.remaining)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${Math.min(paidPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-9 text-right">{paidPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orgTableData.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No approved funding requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request-level detail */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Request Detail</h2>
          <p className="text-xs text-muted-foreground mt-0.5">All approved requests with payment tracking</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Request #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Approved</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition">
                  <td className="p-3 font-mono text-xs">{r.request_number || '""'}</td>
                  <td className="p-3">{r.organization_name || '""'}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{r.program_code || '""'}</span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(r.amount_approved)}</td>
                  <td className="p-3"><PaymentBadge status={r.payment_status} /></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{r.payment_reference || '-'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.payment_date ? r.payment_date.substring(0,10) : '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No requests match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
