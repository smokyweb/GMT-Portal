import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';

const SEVERITY_COLORS = {
  Low: '#64748b',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
};

const TYPE_COLORS = {
  OverdueReport: '#3b82f6',
  MissingDocument: '#8b5cf6',
  FinancialDiscrepancy: '#ef4444',
  MatchShortfall: '#f59e0b',
};

function StatCard({ label, value, sub, color = 'text-foreground' }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function ComplianceTrendsDashboard() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ComplianceFlag.list('-created_date', 500).then(f => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // ── Monthly open vs resolved trend (last 12 months) ──
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), 11 - i));
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy') };
  });

  const monthlyData = months.map(({ key, label }) => {
    const opened = flags.filter(f => {
      const created = f.created_date ? format(parseISO(f.created_date), 'yyyy-MM') : null;
      return created === key;
    }).length;
    const resolved = flags.filter(f => {
      const res = f.resolved_at ? format(parseISO(f.resolved_at), 'yyyy-MM') : null;
      return res === key && f.is_resolved;
    }).length;
    return { label, opened, resolved };
  });

  // ── Severity breakdown ──
  const severityData = ['Low', 'Medium', 'High', 'Critical'].map(s => ({
    name: s,
    value: flags.filter(f => f.severity === s).length,
    open: flags.filter(f => f.severity === s && !f.is_resolved).length,
  })).filter(d => d.value > 0);

  // ── Flag type breakdown ──
  const typeData = ['OverdueReport', 'MissingDocument', 'FinancialDiscrepancy', 'MatchShortfall'].map(t => ({
    name: t.replace(/([A-Z])/g, ' $1').trim(),
    rawType: t,
    open: flags.filter(f => f.flag_type === t && !f.is_resolved).length,
    resolved: flags.filter(f => f.flag_type === t && f.is_resolved).length,
  })).filter(d => d.open + d.resolved > 0);

  // ── KPIs ──
  const totalOpen = flags.filter(f => !f.is_resolved).length;
  const totalResolved = flags.filter(f => f.is_resolved).length;
  const critical = flags.filter(f => f.severity === 'Critical' && !f.is_resolved).length;
  const resolutionRate = flags.length > 0 ? Math.round((totalResolved / flags.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Open Flags" value={totalOpen} color="text-destructive" />
        <StatCard label="Total Resolved" value={totalResolved} color="text-green-600" />
        <StatCard label="Critical Open" value={critical} sub="Require immediate attention" color={critical > 0 ? 'text-red-600' : 'text-foreground'} />
        <StatCard label="Resolution Rate" value={`${resolutionRate}%`} sub="Across all time" color="text-primary" />
      </div>

      {/* Monthly trend chart */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-semibold mb-4">Open vs. Resolved Flags — Last 12 Months</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="opened" name="Opened" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Severity breakdown */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Flags by Severity</h3>
          {severityData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={36}>
                    {severityData.map(entry => (
                      <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {severityData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[d.name] }} />
                      <span>{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{d.value}</span>
                      <span className="text-xs text-muted-foreground ml-1">({d.open} open)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Flag type breakdown */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Flags by Category</h3>
          {typeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" name="Open" fill="hsl(var(--destructive))" radius={[0, 3, 3, 0]} stackId="a" />
                <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[0, 3, 3, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}