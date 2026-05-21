import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, FileText, MessageSquare, Users, Activity, Loader2, ChevronRight } from 'lucide-react';

const KPI_CONFIG = {
  pending_apps: { label: 'Pending Applications', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', path: '/applications' },
  pending_frs: { label: 'Pending Funding Requests', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', path: '/funding-requests' },
  overdue_milestones: { label: 'Overdue Milestones', icon: Clock, color: 'text-red-600', bg: 'bg-red-50', path: '/milestones' },
  open_flags: { label: 'Open Compliance Flags', icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/5', path: '/compliance' },
  docs_review: { label: 'Documents Awaiting Review', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', path: '/documents' },
  unread_msgs: { label: 'Unread Messages', icon: MessageSquare, color: 'text-teal-600', bg: 'bg-teal-50', path: '/messages' },
};

function HealthCard({ label, count, icon: Icon, colorClass, bgClass, path }) {
  return (
    <Link to={path} className="group">
      <div className={`${bgClass} rounded-xl border p-4 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer`}>
        <div className={`h-10 w-10 rounded-lg ${bgClass} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
      </div>
    </Link>
  );
}

export default function SystemHealthDashboard() {
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);

      // Determine scope
      const isFederal = ['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role);
      const isStateAdmin = u.role === 'admin' || u.role === 'reviewer';

      // Load all data
      const [apps, frs, milestones, flags, docs, messages, auditData, orgs] = await Promise.all([
        base44.entities.Application.list('-created_date', 500),
        base44.entities.FundingRequest.list('-created_date', 500),
        base44.entities.Milestone.list('-created_date', 500),
        base44.entities.ComplianceFlag.list('-created_date', 500),
        base44.entities.Document.list('-created_date', 500),
        base44.entities.Message.list('-created_date', 500),
        base44.entities.AuditLog.list('-created_date', 10),
        base44.entities.Organization.list(),
      ]);

      // Filter by state if state admin
      let scopedApps = apps, scopedFRs = frs, scopedMilestones = milestones, scopedFlags = flags, scopedDocs = docs, scopedMsgs = messages;
      if (isStateAdmin && !isFederal && u.scope_state) {
        const stateOrgs = orgs.filter(o => o.state === u.scope_state).map(o => o.id);
        scopedApps = apps.filter(a => stateOrgs.includes(a.organization_id));
        scopedFRs = frs.filter(a => stateOrgs.includes(a.organization_id));
        scopedMilestones = milestones.filter(a => stateOrgs.includes(a.organization_id));
        scopedFlags = flags.filter(a => stateOrgs.includes(a.organization_id));
        scopedDocs = docs.filter(a => stateOrgs.includes(a.organization_id));
        scopedMsgs = messages.filter(a => stateOrgs.includes(a.organization_id));
      }

      const today = new Date().toISOString().split('T')[0];
      
      setMetrics({
        pending_apps: scopedApps.filter(a => a.status === 'Submitted').length,
        pending_frs: scopedFRs.filter(r => r.status === 'Submitted' || r.status === 'UnderReview').length,
        overdue_milestones: scopedMilestones.filter(m => m.due_date < today && m.status !== 'Completed').length,
        open_flags: scopedFlags.filter(f => !f.is_resolved).length,
        docs_review: scopedDocs.filter(d => d.review_status === 'Pending').length,
        unread_msgs: scopedMsgs.filter(m => m.is_read === false).length,
      });

      setAuditLogs(auditData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">System Health Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time system status and critical metrics</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(KPI_CONFIG).map(([key, config]) => (
          <HealthCard
            key={key}
            label={config.label}
            count={metrics[key] || 0}
            icon={config.icon}
            colorClass={config.color}
            bgClass={config.bg}
            path={config.path}
          />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <span className="text-xs text-muted-foreground ml-auto">Last 10 events</span>
        </div>
        <div className="space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No activity yet</p>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded text-xs">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{log.action}</p>
                  <p className="text-muted-foreground">{log.user_name} · {log.entity_type} #{log.entity_id?.slice(0, 8)}</p>
                </div>
                <p className="text-muted-foreground flex-shrink-0">{new Date(log.created_date).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}