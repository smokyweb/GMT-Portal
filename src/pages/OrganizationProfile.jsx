import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, ArrowLeft, AlertTriangle, FileText, Flag, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import { formatDateShort, formatCurrency } from '../lib/helpers';

const MILESTONE_STATUS_COLORS = {
  Completed: 'text-green-600 bg-green-50',
  InProgress: 'text-blue-600 bg-blue-50',
  Upcoming: 'text-slate-600 bg-slate-50',
  Overdue: 'text-red-600 bg-red-50',
  Waived: 'text-muted-foreground bg-muted',
};

export default function OrganizationProfile() {
  const { id } = useParams();
  const [org, setOrg] = useState(null);
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [flags, setFlags] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Organization.filter({ id }),
      base44.entities.Application.filter({ organization_id: id }, '-created_date', 50),
      base44.entities.ReportSchedule.list('-due_date', 200),
      base44.entities.ComplianceFlag.list('-created_date', 200),
      base44.entities.Milestone.filter({ organization_id: id }, '-due_date', 100),
    ]).then(([orgs, apps, allReports, allFlags, miles]) => {
      setOrg(orgs[0] || null);
      setApplications(apps);
      const appIds = new Set(apps.map(a => a.id));
      setReports(allReports.filter(r => appIds.has(r.application_id)));
      setFlags(allFlags.filter(f => f.organization_name === (orgs[0]?.name)));
      setMilestones(miles);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!org) return (
    <div className="p-8 text-center text-muted-foreground">Organization not found.</div>
  );

  const openFlags = flags.filter(f => !f.is_resolved);
  const resolvedFlags = flags.filter(f => f.is_resolved);
  const overdueReports = reports.filter(r => r.status === 'Overdue');
  const completedMilestones = milestones.filter(m => m.status === 'Completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/organizations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition">
          <ArrowLeft className="h-4 w-4" /> Back to Organizations
        </Link>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {org.type}{org.county ? ` • ${org.county} County` : ''}{org.state ? `, ${org.state}` : ''}
            </p>
          </div>
          <div className="ml-auto">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${org.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {org.is_active !== false ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Grants</p>
          <p className="text-2xl font-bold mt-1">{applications.length}</p>
        </div>
        <div className={`border rounded-xl p-4 ${openFlags.length > 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
          <p className="text-xs text-muted-foreground">Open Flags</p>
          <p className={`text-2xl font-bold mt-1 ${openFlags.length > 0 ? 'text-red-600' : ''}`}>{openFlags.length}</p>
        </div>
        <div className={`border rounded-xl p-4 ${overdueReports.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
          <p className="text-xs text-muted-foreground">Overdue Reports</p>
          <p className={`text-2xl font-bold mt-1 ${overdueReports.length > 0 ? 'text-amber-600' : ''}`}>{overdueReports.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Milestones Completed</p>
          <p className="text-2xl font-bold mt-1">{completedMilestones.length} <span className="text-sm font-normal text-muted-foreground">/ {milestones.length}</span></p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="grants">
        <TabsList>
          <TabsTrigger value="grants">Grants ({applications.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="flags">
            Compliance Flags ({openFlags.length} open)
          </TabsTrigger>
          <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
        </TabsList>

        {/* Grants */}
        <TabsContent value="grants" className="mt-4">
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Project Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Expended</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{app.application_number || '—'}</td>
                    <td className="p-3 font-medium">{app.project_title || '—'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{app.program_code || '—'}</span></td>
                    <td className="p-3 text-right">{formatCurrency(app.awarded_amount)}</td>
                    <td className="p-3 text-right">{formatCurrency(app.total_expended)}</td>
                    <td className="p-3"><StatusBadge status={app.status} /></td>
                  </tr>
                ))}
                {applications.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No grants found</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="mt-4">
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{r.application_number || '—'}</td>
                    <td className="p-3">{r.report_type}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDateShort(r.period_start)} – {formatDateShort(r.period_end)}</td>
                    <td className="p-3 text-xs font-medium">{formatDateShort(r.due_date)}</td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No reports found</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Compliance Flags */}
        <TabsContent value="flags" className="mt-4 space-y-4">
          {openFlags.length > 0 && (
            <div className="bg-card rounded-xl border">
              <div className="p-4 border-b flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="font-semibold text-sm">Open Flags</h3>
                <span className="text-xs text-muted-foreground ml-auto">{openFlags.length}</span>
              </div>
              <div className="divide-y">
                {openFlags.map(f => (
                  <div key={f.id} className="p-4 flex items-start gap-3">
                    <SeverityBadge severity={f.severity} />
                    <div>
                      <p className="text-sm font-medium">{f.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.flag_type?.replace(/([A-Z])/g, ' $1').trim()}{f.application_number ? ` • ${f.application_number}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {resolvedFlags.length > 0 && (
            <div className="bg-card rounded-xl border opacity-70">
              <div className="p-4 border-b flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm text-muted-foreground">Resolved</h3>
                <span className="text-xs text-muted-foreground ml-auto">{resolvedFlags.length}</span>
              </div>
              <div className="divide-y">
                {resolvedFlags.map(f => (
                  <div key={f.id} className="p-4 flex items-start gap-3">
                    <SeverityBadge severity={f.severity} />
                    <div>
                      <p className="text-sm font-medium line-through text-muted-foreground">{f.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Resolved {formatDateShort(f.resolved_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {flags.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No compliance flags for this organization.</div>
          )}
        </TabsContent>

        {/* Milestones */}
        <TabsContent value="milestones" className="mt-4">
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map(m => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{m.title}</td>
                    <td className="p-3 text-xs text-muted-foreground">{m.milestone_type?.replace(/([A-Z])/g, ' $1').trim()}</td>
                    <td className="p-3 font-mono text-xs">{m.application_number || '—'}</td>
                    <td className="p-3 text-xs">{formatDateShort(m.due_date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${MILESTONE_STATUS_COLORS[m.status] || 'bg-muted text-muted-foreground'}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {milestones.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No milestones found</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Org Details Footer */}
      <div className="bg-card border rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-muted-foreground">EIN</p><p className="font-mono font-medium mt-0.5">{org.ein || '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">SAM UEI</p><p className="font-mono font-medium mt-0.5">{org.sam_uei || '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium mt-0.5">{org.address ? `${org.address}, ${org.city}` : '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Zip</p><p className="font-medium mt-0.5">{org.zip || '—'}</p></div>
      </div>
    </div>
  );
}