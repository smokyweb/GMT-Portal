import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, DollarSign, Send, Calendar, AlertTriangle, Building2, MapPin, Hash, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '../components/StatusBadge';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort } from '../lib/helpers';

export default function SubrecipientDashboard() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [apps, setApps] = useState([]);
  const [fundingReqs, setFundingReqs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (!u.organization_id) {
        setLoading(false);
        return;
      }
      const orgData = await base44.entities.Organization.filter({ id: u.organization_id });
      if (orgData.length) setOrg(orgData[0]);
      const [a, fr, rs, cf] = await Promise.all([
        base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 50),
        base44.entities.FundingRequest.filter({ organization_id: u.organization_id }, '-created_date', 20),
        base44.entities.ReportSchedule.list('-due_date', 50),
        base44.entities.ComplianceFlag.list('-created_date', 50),
      ]);
      setApps(a);
      setFundingReqs(fr);
      // Filter schedules for this org's applications
      const appIds = new Set(a.map(app => app.id));
      setSchedules(rs.filter(s => appIds.has(s.application_id)));
      setFlags(cf.filter(f => appIds.has(f.application_id) && !f.is_resolved));
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

  if (!user?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Organization Profile Required</h2>
        <p className="text-muted-foreground mb-4 max-w-md">
          Please set up your organization profile before accessing the portal.
        </p>
        <Link to="/my-organization">
          <Button>Set Up Organization</Button>
        </Link>
      </div>
    );
  }

  const activeGrants = apps.filter(a => a.status === 'Approved');
  const inProgress = apps.filter(a => ['Draft', 'Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested'].includes(a.status));
  const upcomingDeadlines = schedules
    .filter(s => s.status === 'Pending' || s.status === 'Overdue')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Org Profile Card */}
      {org && (
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{org.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{org.type}</span>
                  {org.county && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{org.county} County</span>}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${org.is_active !== false ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {org.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <Link to="/my-organization">
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition">
                Edit <ExternalLink className="h-3 w-3" />
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t">
            {org.ein && <div><p className="text-xs text-muted-foreground">EIN</p><p className="text-sm font-mono font-medium">{org.ein}</p></div>}
            {org.sam_uei && <div><p className="text-xs text-muted-foreground">SAM UEI</p><p className="text-sm font-mono font-medium">{org.sam_uei}</p></div>}
            {(org.city || org.state) && <div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-medium">{[org.city, org.state, org.zip].filter(Boolean).join(', ')}</p></div>}
            {org.address && <div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium truncate">{org.address}</p></div>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back</p>
        </div>
        <div className="flex gap-2">
          <Link to="/browse-nofos">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Application</Button>
          </Link>
          <Link to="/my-funding-requests?new=1">
            <Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1" /> Funding Request</Button>
          </Link>
          <Link to="/my-reports">
            <Button size="sm" variant="outline"><Send className="h-4 w-4 mr-1" /> Submit Report</Button>
          </Link>
        </div>
      </div>

      {/* Active Grants */}
      {activeGrants.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Active Grants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeGrants.map(grant => (
              <div key={grant.id} className="bg-card rounded-xl border p-5 space-y-3 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{grant.project_title || 'Untitled'}</p>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium mt-1 inline-block">
                      {grant.program_code}
                    </span>
                  </div>
                  <StatusBadge status={grant.status} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Awarded</p>
                    <p className="font-bold text-base">{formatCurrency(grant.awarded_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="font-bold text-base">{formatCurrency(grant.remaining_balance || grant.awarded_amount)}</p>
                  </div>
                </div>
                <ExpenditureBar rate={grant.expenditure_rate || 0} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Period: {formatDateShort(grant.performance_start)} – {formatDateShort(grant.performance_end)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Applications In Progress */}
        <div className="xl:col-span-2 bg-card rounded-xl border">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="font-semibold">Applications In Progress</h2>
            <Link to="/my-applications"><Button variant="ghost" size="sm">View All</Button></Link>
          </div>
          <div className="divide-y">
            {inProgress.map(app => (
              <div key={app.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{app.project_title || 'Untitled Draft'}</p>
                  <p className="text-xs text-muted-foreground">{app.application_number || 'Not submitted'} • {app.program_code}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={app.status} />
                  <Link to={app.status === 'Draft' || app.status === 'RevisionRequested' ? `/new-application?id=${app.id}` : `/my-applications`}>
                    <Button variant="ghost" size="sm">{app.status === 'Draft' || app.status === 'RevisionRequested' ? 'Continue' : 'View'}</Button>
                  </Link>
                </div>
              </div>
            ))}
            {inProgress.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No applications in progress</p>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-card rounded-xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Upcoming Deadlines</h2>
          </div>
          <div className="p-4 space-y-3">
            {upcomingDeadlines.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.report_type} Report</p>
                  <p className="text-xs text-muted-foreground">Due: {formatDateShort(s.due_date)}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {upcomingDeadlines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            )}
          </div>

          {/* Compliance Alerts */}
          {flags.length > 0 && (
            <>
              <div className="px-5 pb-2 pt-4 border-t">
                <h3 className="font-semibold text-sm text-red-600">Compliance Alerts</h3>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {flags.slice(0, 3).map(f => (
                  <div key={f.id} className="p-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-xs font-medium text-red-700">{f.description}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Funding Requests */}
      {fundingReqs.length > 0 && (
        <div className="bg-card rounded-xl border">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="font-semibold">Recent Funding Requests</h2>
            <Link to="/my-funding-requests"><Button variant="ghost" size="sm">View All</Button></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Request #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {fundingReqs.slice(0, 5).map(fr => (
                  <tr key={fr.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{fr.request_number || '—'}</td>
                    <td className="p-3">{fr.request_type}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(fr.amount_requested)}</td>
                    <td className="p-3"><StatusBadge status={fr.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}