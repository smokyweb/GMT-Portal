import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie, Tooltip as PieTooltip
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';

const PROGRAM_COLORS = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ef4444','#06b6d4','#f97316','#84cc16'];

const BURN_RISK = (rate) => {
  if (rate === null || rate === undefined) return null;
  if (rate >= 90) return { label: 'Over-Budget Risk', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle };
  if (rate >= 75) return { label: 'On Track', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: TrendingUp };
  if (rate >= 40) return { label: 'Moderate Spend', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Activity };
  return { label: 'Under-Spending', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: TrendingDown };
};

const fmt = (v) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`;

function KPICard({ label, value, sub, accent }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${accent || ''}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function FinancialOverview() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProgram, setFilterProgram] = useState('all');

  useEffect(() => {
    base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 500)
      .then(data => { setApps(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() =>
    filterProgram === 'all' ? apps : apps.filter(a => a.program_code === filterProgram),
    [apps, filterProgram]
  );

  const programs = useMemo(() => [...new Set(apps.map(a => a.program_code).filter(Boolean))], [apps]);

  // --- Per-program aggregates ---
  const programData = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const p = a.program_code || 'Unknown';
      if (!map[p]) map[p] = { program: p, awarded: 0, expended: 0, count: 0 };
      map[p].awarded += a.awarded_amount || 0;
      map[p].expended += a.total_expended || 0;
      map[p].count += 1;
    });
    return Object.values(map).map(d => ({
      ...d,
      remaining: d.awarded - d.expended,
      burnRate: d.awarded > 0 ? Math.round((d.expended / d.awarded) * 100) : 0,
    })).sort((a, b) => b.awarded - a.awarded);
  }, [filtered]);

  // --- Portfolio KPIs ---
  const totalAwarded = filtered.reduce((s, a) => s + (a.awarded_amount || 0), 0);
  const totalExpended = filtered.reduce((s, a) => s + (a.total_expended || 0), 0);
  const totalRemaining = totalAwarded - totalExpended;
  const portfolioBurnRate = totalAwarded > 0 ? Math.round((totalExpended / totalAwarded) * 100) : 0;

  // High-risk projects (>90% burn or 0% with past mid-point)
  const highRisk = filtered.filter(a => {
    const rate = a.awarded_amount > 0 ? (a.total_expended || 0) / a.awarded_amount * 100 : 0;
    return rate >= 90;
  });
  const underSpending = filtered.filter(a => {
    const rate = a.awarded_amount > 0 ? (a.total_expended || 0) / a.awarded_amount * 100 : 0;
    return rate < 20 && a.awarded_amount > 0;
  });

  // --- Per-project burn rate scatter data (top 20 by award) ---
  const projectData = useMemo(() =>
    [...filtered]
      .filter(a => a.awarded_amount > 0)
      .sort((a, b) => (b.awarded_amount || 0) - (a.awarded_amount || 0))
      .slice(0, 25)
      .map(a => ({
        name: a.application_number || 'Draft',
        org: a.organization_name,
        program: a.program_code,
        awarded: a.awarded_amount,
        expended: a.total_expended || 0,
        rate: a.awarded_amount > 0 ? Math.round(((a.total_expended || 0) / a.awarded_amount) * 100) : 0,
      })),
    [filtered]
  );

  // Pie chart: allocation by program
  const pieData = programData.map((d, i) => ({
    name: d.program, value: d.awarded, color: PROGRAM_COLORS[i % PROGRAM_COLORS.length]
  }));

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
          <h1 className="text-2xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Budget allocations vs. actual expenditures across approved grants</p>
        </div>
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Awarded" value={fmt(totalAwarded)} sub={`${filtered.length} grants`} />
        <KPICard label="Total Expended" value={fmt(totalExpended)} sub={`${portfolioBurnRate}% burn rate`} />
        <KPICard label="Remaining Balance" value={fmt(totalRemaining)} />
        <KPICard
          label="High-Risk Projects"
          value={highRisk.length}
          sub={`${underSpending.length} under-spending`}
          accent={highRisk.length > 0 ? 'border-red-200 bg-red-50/30' : ''}
        />
      </div>

      {/* Awarded vs Expended by Program */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Awarded vs. Expended by Program</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={programData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="program" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="awarded" name="Awarded" fill="#3b82f6" radius={[4,4,0,0]} />
            <Bar dataKey="expended" name="Expended" fill="#22c55e" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Burn Rate by Program + Allocation Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Burn Rate by Program (%)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={programData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="program" tick={{ fontSize: 12 }} width={50} />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="burnRate" name="Burn Rate" radius={[0,4,4,0]}>
                {programData.map((d, i) => (
                  <Cell key={i} fill={d.burnRate >= 90 ? '#ef4444' : d.burnRate >= 75 ? '#22c55e' : d.burnRate >= 40 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Allocation by Program</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <PieTooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Project-level burn rate table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Project Burn Rates (Top 25 by Award)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Expended</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-40">Burn Rate</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Risk</th>
              </tr>
            </thead>
            <tbody>
              {projectData.map((p, i) => {
                const risk = BURN_RISK(p.rate);
                const RiskIcon = risk?.icon;
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition">
                    <td className="p-3 font-mono text-xs">{p.name}</td>
                    <td className="p-3 max-w-[160px] truncate">{p.org}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{p.program}</span>
                    </td>
                    <td className="p-3 text-right font-medium">{formatCurrency(p.awarded)}</td>
                    <td className="p-3 text-right">{formatCurrency(p.expended)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(p.rate, 100)}%`,
                              backgroundColor: p.rate >= 90 ? '#ef4444' : p.rate >= 75 ? '#22c55e' : p.rate >= 40 ? '#f59e0b' : '#3b82f6'
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-9 text-right">{p.rate}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {risk && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${risk.bg} ${risk.color}`}>
                          <RiskIcon className="h-3 w-3" />{risk.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {projectData.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No approved grants with financial data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}