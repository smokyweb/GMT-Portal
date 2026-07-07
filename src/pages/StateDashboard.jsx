import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { runGrantMonitor } from '../lib/monitoringService';
import { DollarSign, Users, ClipboardList, Shield, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { runReportDueDateService } from '../lib/reportDueDateService';
import RiskScoreTable from '../components/RiskScoreTable';
import WorkflowPipeline from '../components/WorkflowPipeline';
import DashboardCustomizer from '../components/DashboardCustomizer';
import DashboardExportButton from '../components/DashboardExportButton';
import { Download } from 'lucide-react';

const DEFAULT_WIDGETS = [
  { id: 'kpis', label: 'KPI Summary', description: 'Total awards, subrecipients, reviews, flags', visible: true },
  { id: 'recent_apps', label: 'Recent Applications', description: 'Latest application submissions', visible: true },
  { id: 'compliance_alerts', label: 'Compliance Alerts', description: 'Open compliance flags', visible: true },
  { id: 'workflow', label: 'Workflow Pipeline', description: 'Application & funding request pipeline', visible: true },
  { id: 'risk_table', label: 'Risk Score Table', description: 'Organization risk assessment', visible: true },
  // monitoring widget removed - runs silently in background
  { id: 'expenditure_chart', label: 'Expenditure Chart', description: 'Expenditure rate by program', visible: true },
];

export default function StateDashboard({ filteredApps, allApps, filters, setFilters }) {
  const [apps, setApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [fundingReqs, setFundingReqs] = useState([]);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);

  // Use filtered apps if provided, otherwise fall back to all apps
  const displayApps = filteredApps || apps;

  const handleSaveWidgets = async (updated) => {
    setWidgets(updated);
    await base44.auth.updateMe({ state_dashboard_widgets: JSON.stringify(updated) });
  };

  const isVisible = (id) => widgets.find(w => w.id === id)?.visible !== false;

  useEffect(() => {
    // Run background services (throttled, silent - no UI spinner)
    runReportDueDateService();
    base44.auth.me().then(u => {
      // Run grant monitor silently in background after user loads
      runGrantMonitor(u).catch(() => {});
      setCurrentUser(u);
      if (u?.state_dashboard_widgets) {
        try {
          const saved = JSON.parse(u.state_dashboard_widgets);
          // Merge saved prefs with defaults to handle new widgets
          const merged = DEFAULT_WIDGETS.map(dw => {
            const found = saved.find(s => s.id === dw.id);
            return found ? { ...dw, ...found } : dw;
          });
          setWidgets(merged);
        } catch {}
      }
    });
    // Load all data, then filter by scope_state for state admin users
    Promise.all([
      base44.entities.Application.list('-created_date', 500),
      base44.entities.Organization.list('-created_date', 500),
      base44.entities.ComplianceFlag.filter({ is_resolved: false }, '-created_date', 500),
      base44.entities.FundingRequest.list('-created_date', 500),
      base44.entities.ReportSchedule.filter({ status: 'Overdue' }, '-due_date', 200),
      base44.entities.Task.list('-created_date', 200),
    ]).then(([a, o, f, fr, rs, t]) => {
      // Get the current user's scope_state from the already-set currentUser, or re-fetch
      base44.auth.me().then(u => {
        if (u?.scope_state && ['admin', 'reviewer'].includes(u.role)) {
          const stateOrgs = o.filter(org => org.state === u.scope_state);
          const stateOrgIds = new Set(stateOrgs.map(org => org.id));
          const stateApps = a.filter(app => stateOrgIds.has(app.organization_id));
          const stateAppIds = new Set(stateApps.map(app => app.id));
          setApps(stateApps);
          setOrgs(stateOrgs);
          setFlags(f.filter(flag => stateOrgIds.has(flag.organization_id) || stateAppIds.has(flag.application_id)));
          setFundingReqs(fr.filter(req => stateOrgIds.has(req.organization_id)));
          setReports(rs.filter(r => stateAppIds.has(r.application_id)));
          setTasks(t.filter(task => stateOrgIds.has(task.organization_id) || !task.organization_id));
        } else {
          // isc_admin / federal: see all
          setApps(a);
          setOrgs(o);
          setFlags(f);
          setFundingReqs(fr);
          setReports(rs);
          setTasks(t);
        }
        setLoading(false);
      }).catch(() => {
        setApps(a); setOrgs(o); setFlags(f); setFundingReqs(fr); setReports(rs); setTasks(t);
        setLoading(false);
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalAwarded = displayApps.filter(a => a.status === 'Approved').reduce((s, a) => s + (Number(a.awarded_amount) || 0), 0);

   // Filter active orgs by scope (state admins see only their state's orgs)
   const scopedOrgs = currentUser?.scope_state
     ? orgs.filter(o => o.state === currentUser.scope_state && o.is_active !== false)
     : orgs.filter(o => o.is_active !== false);
   const activeOrgs = scopedOrgs.length;

   // Separate app reviews from FR reviews (do NOT combine)
   const PENDING_APP_STATUSES = ['Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested'];
   const PENDING_FR_STATUSES = ['Submitted', 'UnderReview', 'AdditionalInfoRequested'];
   const pendingAppReviews = displayApps.filter(a => PENDING_APP_STATUSES.includes(a.status)).length;
   const pendingFRReviews = fundingReqs.filter(fr => PENDING_FR_STATUSES.includes(fr.status)).length;
   const pendingReviews = pendingAppReviews + pendingFRReviews;

   // Draft counts (separate from pending)
   const draftApps = displayApps.filter(a => a.status === 'Draft').length;

   const highFlags = flags.filter(f => f.severity === 'High' || f.severity === 'Critical').length;

  // Expenditure by program
  const approvedApps = displayApps.filter(a => a.status === 'Approved');
  const programMap = {};
  approvedApps.forEach(a => {
    const code = a.program_code || 'Other';
    if (!programMap[code]) programMap[code] = { program: code, awarded: 0, expended: 0 };
    programMap[code].awarded += Number(a.awarded_amount) || 0;
    programMap[code].expended += Number(a.total_expended) || 0;
  });
  const chartData = Object.values(programMap).map(p => ({
    ...p,
    rate: p.awarded > 0 ? Math.round((p.expended / p.awarded) * 100) : 0,
  }));

  const recentApps = displayApps.slice(0, 8);

  const handleExportCsv = () => {
    try {
      // Build CSV client-side - no server function needed
      const headers = ['App #', 'Organization', 'Program', 'NOFO', 'Status', 'Requested ($)', 'Awarded ($)', 'Expended ($)', 'Remaining ($)', 'Perf Start', 'Perf End'];
      const toCsvField = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
      const rows = displayApps.map(a => [
        a.application_number, a.organization_name, a.program_code, a.nofo_title,
        a.status,
        Number(a.requested_amount || 0).toFixed(2),
        Number(a.awarded_amount || 0).toFixed(2),
        Number(a.total_expended || 0).toFixed(2),
        Number(a.remaining_balance || 0).toFixed(2),
        a.performance_start || '', a.performance_end || '',
      ].map(toCsvField).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.setAttribute('download', `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">State Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Grant management overview</p>
        </div>
        <div className="flex items-center gap-2">
           <DashboardCustomizer widgets={widgets} onSave={handleSaveWidgets} />
           <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
             <Download className="h-4 w-4" /> Export CSV
           </Button>
        </div>
      </div>
      {/* KPIs */}
      {isVisible('kpis') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Grants Awarded" value={formatCurrency(totalAwarded)} icon={DollarSign} />
          <KPICard title="Active Subrecipients" value={activeOrgs} subtitle={`${orgs.length} total registered`} icon={Users} />
          <KPICard title="Apps Pending Review" value={pendingAppReviews} subtitle={`${pendingFRReviews} funding requests pending`} icon={ClipboardList} />
          <KPICard title="Open Compliance Flags" value={flags.length} subtitle={`${highFlags} high/critical`} icon={Shield} />
        </div>
      )}

      {(isVisible('recent_apps') || isVisible('compliance_alerts')) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent Applications */}
          {isVisible('recent_apps') && (
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
                        <td className="p-3 font-mono text-xs">{app.application_number || ' - '}</td>
                        <td className="p-3">{app.organization_name || ' - '}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                            {app.program_code || ' - '}
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
          )}

          {/* Compliance Alerts */}
          {isVisible('compliance_alerts') && (
            <div className="bg-card rounded-xl border">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="font-semibold">Compliance Alerts</h2>
                <Link to="/compliance-flags">
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
          )}
        </div>
      )}

      {/* Workflow Pipeline */}
      {isVisible('workflow') && <WorkflowPipeline apps={apps} fundingReqs={fundingReqs} flags={flags} reports={reports} tasks={tasks} />}

      {/* Risk Score Table */}
      {isVisible('risk_table') && <RiskScoreTable />}

      {/* Monitoring Panel removed - runs silently in background */}

      {/* Expenditure Chart */}
      {isVisible('expenditure_chart') && chartData.length > 0 && (
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