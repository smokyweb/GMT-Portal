import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '../lib/helpers';
import { isFederalAdmin } from '../lib/permissions';
import KPICard from '../components/KPICard';
import RoleBadge from '../components/RoleBadge';
import DashboardFilterBar, { DEFAULT_FILTERS, applyDashboardFilters } from '../components/DashboardFilterBar';
import { Globe, Building2, FileText, DollarSign, Shield, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#9333ea'];

export default function FederalDashboard() {
  const [user, setUser] = useState(null);
  const [allApps, setAllApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [allFlags, setAllFlags] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.Application.list('-created_date', 500),
      base44.entities.Organization.list(),
      base44.entities.ComplianceFlag.filter({ is_resolved: false }),
      base44.entities.FundingRequest.list('-created_date', 200),
      base44.entities.GrantProgram.list(),
    ]).then(([u, apps, orgList, flags, fundingReqs, progs]) => {
      setUser(u);
      setAllApps(apps);
      setOrgs(orgList);
      setAllFlags(flags);
      setPrograms(progs);
      setLoading(false);
    });
  }, []);

  // Apply FY + program + status filters
  const filteredApps = useMemo(() => applyDashboardFilters(allApps, filters), [allApps, filters]);

  const stats = useMemo(() => {
    if (!filteredApps.length && !allApps.length) return null;
    const flags = allFlags; // flags don't have performance dates, keep unfiltered

    const byState = {};
    orgs.forEach(org => {
      const state = org.state || 'Unknown';
      if (!byState[state]) byState[state] = { state, orgs: 0, apps: 0, awarded: 0, flags: 0 };
      byState[state].orgs++;
    });
    filteredApps.forEach(app => {
      const org = orgs.find(o => o.id === app.organization_id);
      const state = org?.state || 'Unknown';
      if (!byState[state]) byState[state] = { state, orgs: 0, apps: 0, awarded: 0, flags: 0 };
      byState[state].apps++;
      if (app.awarded_amount) byState[state].awarded += app.awarded_amount;
    });
    flags.forEach(flag => {
      const org = orgs.find(o => o.name === flag.organization_name);
      const state = org?.state || 'Unknown';
      if (!byState[state]) byState[state] = { state, orgs: 0, apps: 0, awarded: 0, flags: 0 };
      byState[state].flags++;
    });

    const stateRows = Object.values(byState).filter(r => r.apps > 0 || r.flags > 0).sort((a, b) => b.awarded - a.awarded);
    const totalAwarded  = filteredApps.reduce((s, a) => s + (a.awarded_amount || 0), 0);
    const pendingReview = filteredApps.filter(a => ['Submitted', 'PendingReview', 'UnderReview'].includes(a.status)).length;
    const totalExpended = filteredApps.reduce((s, a) => s + (a.total_expended || 0), 0);

    return {
      totalOrgs: orgs.length,
      totalApps: filteredApps.length,
      totalAwarded,
      totalExpended,
      openFlags: flags.length,
      criticalFlags: flags.filter(f => f.severity === 'Critical').length,
      pendingReview,
      activePrograms: programs.filter(p => p.is_active).length,
      stateRows,
      programBreakdown: programs.map(p => ({
        name: p.code || p.name,
        apps: filteredApps.filter(a => a.program_code === p.code).length,
        awarded: filteredApps.filter(a => a.program_code === p.code).reduce((s, a) => s + (a.awarded_amount || 0), 0),
      })).filter(p => p.apps > 0),
    };
  }, [filteredApps, orgs, allFlags, programs]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-purple-600" />
            <h1 className="text-2xl font-bold tracking-tight">Federal Overview</h1>
            <RoleBadge role={user?.role} />
          </div>
          <p className="text-muted-foreground text-sm">
            System-wide visibility across all states, organizations, and grant programs.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <DashboardFilterBar
        apps={allApps}
        filters={filters}
        setFilters={setFilters}
        isStateView={true}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Organizations" value={stats.totalOrgs} icon={<Building2 className="h-5 w-5 text-blue-600" />} />
        <KPICard title="Total Applications" value={stats.totalApps} icon={<FileText className="h-5 w-5 text-indigo-600" />} subtitle={`${stats.pendingReview} pending review`} />
        <KPICard title="Total Awarded" value={formatCurrency(stats.totalAwarded)} icon={<DollarSign className="h-5 w-5 text-green-600" />} subtitle={`${formatCurrency(stats.totalExpended)} expended`} />
        <KPICard title="Open Compliance Flags" value={stats.openFlags} icon={<Shield className="h-5 w-5 text-red-600" />} subtitle={stats.criticalFlags > 0 ? `${stats.criticalFlags} critical` : 'No critical flags'} />
      </div>

      {/* Two columns: state table + program chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* State Rollup Table */}
        <div className="bg-card rounded-xl border">
          <div className="p-5 border-b flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">State Rollup</h2>
            <span className="ml-auto text-xs text-muted-foreground">{stats.stateRows.length} states</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">State</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Orgs</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Apps</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Awarded</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Flags</th>
                </tr>
              </thead>
              <tbody>
                {stats.stateRows.map((row, i) => (
                  <tr key={row.state} className="border-b last:border-0 hover:bg-muted/20 transition">
                    <td className="px-4 py-2.5 font-medium">{row.state}</td>
                    <td className="px-4 py-2.5 text-right">{row.orgs}</td>
                    <td className="px-4 py-2.5 text-right">{row.apps}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.awarded)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {row.flags > 0
                        ? <span className="text-red-600 font-semibold">{row.flags}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
                {stats.stateRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No state data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Program Breakdown Chart */}
        <div className="bg-card rounded-xl border">
          <div className="p-5 border-b flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Funding by Program</h2>
          </div>
          <div className="p-4">
            {stats.programBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.programBreakdown} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="awarded" radius={[4, 4, 0, 0]}>
                    {stats.programBreakdown.map((_, i) => (
                      <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No program data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Permission scope notice for federal_officer */}
      {user?.role === 'federal_officer' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-800">Read-Only Access</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              As a Federal Program Officer, you have full visibility into all states and programs but cannot modify records, approve applications, or manage users.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}