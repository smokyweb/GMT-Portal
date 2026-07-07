import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import {
  AlertTriangle, TrendingUp, DollarSign, Activity, CheckCircle2,
  Clock, Target, BarChart2, TrendingDown, Zap
} from 'lucide-react';
import { formatCurrency, formatDateShort } from '../lib/helpers';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#f97316'];
const fmt = (v) => `$${(v / 1000).toFixed(0)}k`;

function SectionTitle({ icon: Icon, children, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{children}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs font-semibold flex items-center gap-0.5 flex-shrink-0 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      {label && <p className="font-semibold mb-1.5 text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PortalAnalyticsTab({ apps, fundingRequests }) {
  const activeGrants = apps.filter(a => a.status === 'Approved');
  const totalAwarded = activeGrants.reduce((s, g) => s + (Number(g.awarded_amount) || 0), 0);
  const totalExpended = activeGrants.reduce((s, g) => s + (Number(g.total_expended) || 0), 0);
  // Remaining = awarded - expended (recalculated, not from DB field which may be stale)
  const totalRemaining = totalAwarded - totalExpended;
  const overallRate = totalAwarded > 0 ? Math.round((totalExpended / totalAwarded) * 100) : 0;
  // Reimbursed = sum of Paid funding requests only
  const paidFRs = fundingRequests.filter(fr => fr.payment_status === 'Paid');
  const totalReimbursed = paidFRs.reduce((s, fr) => s + (Number(fr.amount_approved) || Number(fr.amount_requested) || 0), 0);

  // ── 1. Actual vs Projected Spend per Grant ────────────────────────────────
  const actualVsProjected = useMemo(() => {
    return activeGrants.map(g => {
      const awarded = g.awarded_amount || 0;
      const expended = g.total_expended || 0;
      let projected = 0;
      if (g.performance_start && g.performance_end) {
        const start = new Date(g.performance_start).getTime();
        const end = new Date(g.performance_end).getTime();
        const now = Date.now();
        const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
        projected = Math.round(awarded * elapsed);
      }
      return {
        name: g.application_number || g.program_code,
        Actual: expended,
        Projected: projected,
        Awarded: awarded,
      };
    });
  }, [activeGrants]);

  // ── 2. Expenditure Rate Trend ─────────────────────────────────────────────
  const rateTrend = useMemo(() => {
    const relevant = fundingRequests
      .filter(fr => ['Approved', 'Submitted', 'UnderReview'].includes(fr.status))
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const byMonth = {};
    relevant.forEach(fr => {
      const d = new Date(fr.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, totalRequested: 0, totalApproved: 0, count: 0 };
      byMonth[key].totalRequested += Number(fr.amount_requested) || 0;
      byMonth[key].totalApproved += Number(fr.amount_approved) || 0;
      byMonth[key].count += 1;
    });
    let cumRequested = 0;
    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(m => {
        cumRequested += m.totalRequested;
        const rate = totalAwarded > 0 ? Math.min(100, (cumRequested / totalAwarded) * 100) : 0;
        const [yr, mo] = m.month.split('-');
        const label = new Date(Number(yr), Number(mo) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        return { month: label, 'Rate (%)': Math.round(rate * 10) / 10, 'Requests': m.count };
      });
  }, [fundingRequests, totalAwarded]);

  // ── 3. By Program ─────────────────────────────────────────────────────────
  const byProgram = useMemo(() => {
    const acc = {};
    activeGrants.forEach(g => {
      const key = g.program_code || 'Other';
      if (!acc[key]) acc[key] = { name: key, Awarded: 0, Expended: 0 };
      acc[key].Awarded += Number(g.awarded_amount) || 0;
      acc[key].Expended += Number(g.total_expended) || 0;
    });
    return Object.values(acc);
  }, [activeGrants]);

  // ── 4. Funding Request Status Breakdown ───────────────────────────────────
  const frStatusData = useMemo(() => {
    const counts = {};
    fundingRequests.forEach(fr => {
      counts[fr.status] = (counts[fr.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [fundingRequests]);

  // ── 5. Budget Alerts ──────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    return activeGrants.map(g => {
      const remaining = g.remaining_balance ?? (g.awarded_amount - (Number(g.total_expended) || 0));
      const rate = g.expenditure_rate || 0;
      const daysLeft = g.performance_end
        ? Math.max(0, Math.ceil((new Date(g.performance_end) - new Date()) / 86400000))
        : null;
      let severity = null;
      if (rate > 95) severity = 'critical';
      else if (rate > 85) severity = 'high';
      else if (remaining < 10000 && remaining >= 0) severity = 'low-balance';
      else if (daysLeft !== null && daysLeft < 60 && rate < 50) severity = 'slow-burn';
      return { ...g, remaining, rate, daysLeft, severity };
    }).filter(g => g.severity !== null);
  }, [activeGrants]);

  const severityConfig = {
    critical: { label: 'Critical - Budget Nearly Exhausted', bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
    high: { label: 'High Spend - Over 85% Used', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
    'low-balance': { label: 'Low Balance - Under $10k Remaining', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
    'slow-burn': { label: 'Slow Burn - Low Spend Near Deadline', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400' },
  };

  const frStatusColors = {
    Submitted: '#3b82f6',
    UnderReview: '#a855f7',
    AdditionalInfoRequested: '#f59e0b',
    Approved: '#22c55e',
    Denied: '#ef4444',
  };

  if (activeGrants.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
        <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No active grants to analyze</p>
        <p className="text-sm mt-1">Analytics will appear once you have approved grant allocations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Top KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Awarded" value={formatCurrency(totalAwarded)} icon={DollarSign} color="green" />
        <KpiCard label="Total Expended" value={formatCurrency(totalExpended)} sub={`${overallRate}% of portfolio`} icon={TrendingUp} color="blue" />
        <KpiCard label="Remaining Balance" value={formatCurrency(totalRemaining)} icon={Target} color={totalRemaining < 10000 ? 'red' : 'purple'} />
        <KpiCard label="Total Reimbursed" value={formatCurrency(totalReimbursed)} sub={`${approvedFRs.length} approved requests`} icon={CheckCircle2} color="green" />
      </div>

      {/* ── Budget Alerts ── */}
      {alerts.length > 0 && (
        <div>
          <SectionTitle icon={AlertTriangle} sub="Grants requiring your attention">Budget Alerts</SectionTitle>
          <div className="space-y-2">
            {alerts.map(g => {
              const cfg = severityConfig[g.severity];
              return (
                <div key={g.id} className={`border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap ${cfg.bg}`}>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    <p className="font-semibold mt-1.5">{g.project_title || g.application_number}</p>
                    <p className={`text-xs mt-0.5 ${cfg.text}`}>
                      {g.program_code} · {Math.round(g.rate)}% expended · {formatCurrency(g.remaining)} remaining
                      {g.daysLeft !== null ? ` · ${g.daysLeft}d left` : ''}
                    </p>
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Spent</span><span className="font-semibold">{Math.round(g.rate)}%</span>
                    </div>
                    <div className="h-2 bg-white/70 rounded-full overflow-hidden border">
                      <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${Math.min(100, g.rate)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Grant Health Scorecard ── */}
      <div>
        <SectionTitle icon={BarChart2} sub="Financial snapshot across all active grants">Grant Health Scorecard</SectionTitle>
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Expended</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Balance</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Progress</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Ends</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Health</th>
                </tr>
              </thead>
              <tbody>
                {activeGrants.map(g => {
                  const rate = g.expenditure_rate || 0;
                  const remaining = g.remaining_balance ?? (g.awarded_amount - (Number(g.total_expended) || 0));
                  const daysLeft = g.performance_end
                    ? Math.max(0, Math.ceil((new Date(g.performance_end) - new Date()) / 86400000))
                    : null;
                  let health, hColor, hBg;
                  if (rate > 95 || (remaining < 10000 && remaining >= 0)) { health = 'At Risk'; hColor = 'text-red-700'; hBg = 'bg-red-50'; }
                  else if (rate > 80 || (daysLeft !== null && daysLeft < 60 && rate < 40)) { health = 'Watch'; hColor = 'text-amber-700'; hBg = 'bg-amber-50'; }
                  else { health = 'On Track'; hColor = 'text-green-700'; hBg = 'bg-green-50'; }
                  const barColor = rate > 90 ? 'bg-red-500' : rate > 75 ? 'bg-amber-500' : 'bg-primary';
                  return (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-medium text-xs leading-snug">{g.project_title || ' - '}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{g.application_number} · {g.program_code}</p>
                      </td>
                      <td className="p-3 text-right text-xs font-semibold text-green-700">{formatCurrency(g.awarded_amount)}</td>
                      <td className="p-3 text-right text-xs">{formatCurrency(g.total_expended)}</td>
                      <td className="p-3 text-right text-xs font-semibold">{formatCurrency(remaining)}</td>
                      <td className="p-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, rate)}%` }} />
                          </div>
                          <span className="text-[11px] font-medium w-8 text-right">{Math.round(rate)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateShort(g.performance_end)}
                        {daysLeft !== null && <span className={`ml-1 font-medium ${daysLeft < 60 ? 'text-amber-600' : ''}`}>({daysLeft}d)</span>}
                      </td>
                      <td className="p-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${hBg} ${hColor}`}>{health}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Actual vs Projected Spend ── */}
      <div>
        <SectionTitle icon={DollarSign} sub="Linear projection based on time elapsed in each performance period">Actual vs. Projected Spend by Grant</SectionTitle>
        <div className="bg-card border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={actualVsProjected} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
              <Bar dataKey="Projected" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Trend + FR Status side by side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rateTrend.length > 1 && (
          <div>
            <SectionTitle icon={TrendingUp} sub="Cumulative spend pace vs. 80% target">Expenditure Rate Over Time</SectionTitle>
            <div className="bg-card border rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={rateTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={35} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip formatter={v => `${v}%`} />} />
                  <Area type="monotone" dataKey="Rate (%)" stroke="#3b82f6" strokeWidth={2} fill="url(#rateGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line data={rateTrend.map(d => ({ ...d, target: 80 }))} type="monotone" dataKey="target" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1.5} dot={false} legendType="none" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-muted-foreground text-center mt-1">Dashed = 80% target pace</p>
            </div>
          </div>
        )}

        {frStatusData.length > 0 && (
          <div>
            <SectionTitle icon={Zap} sub="Breakdown of your submitted funding requests">Funding Request Status</SectionTitle>
            <div className="bg-card border rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={frStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                  >
                    {frStatusData.map((entry, i) => (
                      <Cell key={i} fill={frStatusColors[entry.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── By Program ── */}
      {byProgram.length > 1 && (
        <div>
          <SectionTitle icon={Activity} sub="Awarded vs. expended across grant programs">Budget Utilization by Program</SectionTitle>
          <div className="bg-card border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProgram} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Awarded" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Expended" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}