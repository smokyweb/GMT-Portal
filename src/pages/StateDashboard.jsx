import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import MonitoringPanel from '../components/MonitoringPanel';
import { DollarSign, Users, ClipboardList, Shield, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { runReportDueDateService } from '../lib/reportDueDateService';
import RiskScoreTable from '../components/RiskScoreTable';

export default function StateDashboard() {
  const [apps, setApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [fundingReqs, setFundingReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Run daily report due-date service (throttled to once per 24h)
    runReportDueDateService();
    base44.auth.me().then(u => setCurrentUser(u));
    Promise.all([
      base44.entities.Application.list('-created_date', 50),
      base44.entities.Organization.list(),
      base44.entities.ComplianceFlag.filter({ is_resolved: false }),
      base44.entities.FundingRequest.list('-created_date', 50),
    ]).then(([a, o, f, fr]) => {
      setApps(a);
      setOrgs(o);
      setFlags(f);
      setFundingReqs(fr);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalAwarded = apps.filter(a => a.status === 'Approved').reduce((s, a) => s + (a.awarded_amount || 0), 0);
  const activeOrgs = orgs.filter(o => o.is_active !== false).length;
  const pendingReviews = apps.filter(a => ['Submitted', 'PendingReview', 'UnderReview'].includes(a.status)).length
    + fundingReqs.filter(fr => ['Submitted', 'UnderReview'].includes(fr.status)).length;
  const highFlags = flags.filter(f => f.severity === 'High' || f.severity === 'Critical').length;

  // Expenditure by program
  const approvedApps = apps.filter(a => a.status === 'Approved');
  const programMap = {};
  approvedApps.forEach(a => {
    const code = a.program_code || 'Other';
    if (!programMap[code]) programMap[code] = { program: code, awarded: 0, expended: 0 };
    programMap[code].awarded += a.awarded_amount || 0;
    programMap[code].expended += a.total_expended || 0;
  });
  const chartData = Object.values(programMap).map(p => ({
    ...p,
    rate: p.awarded > 0 ? Math.round((p.expended / p.awarded) * 100) : 0,
  }));

  const recentApps = apps.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">State Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Grant management overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Grants Awarded" value={formatCurrency(totalAwarded)} icon={DollarSign} />
        <KPICard title="Active Subrecipients" value={activeOrgs} subtitle={`${orgs.length} total registered`} icon={Users} />
        <KPICard title="Pending Reviews" value={pendingReviews} subtitle="Applications + Funding requests" icon={ClipboardList} />
        <KPICard title="Compliance Flags" value={flags.length} subtitle={`${highFlags} high/critical`} icon={Shield} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Applications */}
        <div className="xl:col-span-2 bg-card rounded-xl border">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="font-semibold">Recent Applications</h2>
            <Link to="/applications">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map(app => (
                  <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                    <td className="p-3 font-mono text-xs">{app.application_number || '—'}</td>
                    <td className="p-3">{app.organization_name || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                        {app.program_code || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium">{formatCurrency(app.requested_amount)}</td>
                    <td className="p-3"><StatusBadge status={app.status} /></td>
                    <td className="p-3 text-muted-foreground text-xs">{formatDateShort(app.submitted_at)}</td>
                    <td className="p-3">
                      <Link to={`/applications?review=${app.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentApps.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No applications yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Alerts */}
        <div className="bg-card rounded-xl border">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="font-semibold">Compliance Alerts</h2>
            <Link to="/compliance">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {flags.slice(0, 6).map(flag => (
              <div key={flag.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <SeverityBadge severity={flag.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{flag.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {flag.organization_name} • {flag.application_number}
                  </p>
                </div>
              </div>
            ))}
            {flags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No active flags</p>
            )}
          </div>
        </div>
      </div>

      {/* Risk Score Table */}
      <RiskScoreTable />

      {/* Monitoring Panel */}
      <MonitoringPanel user={currentUser} />

      {/* Expenditure Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Expenditure Rate by Program</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="program" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(val) => `${val}%`} />
              <Bar dataKey="rate" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}