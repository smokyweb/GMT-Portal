import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import DocumentReviewSettings from '../components/DocumentReviewSettings';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency, formatDateShort } from '../lib/helpers';

export default function AdminApplicationsDocReview() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter] = useState('all');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const allApps = await base44.entities.Application.list('-created_date', 200);
      // Scope to state admin's state
      let appList = allApps;
      if (u?.scope_state && ['admin','reviewer'].includes(u.role)) {
        const orgs = await base44.entities.Organization.filter({ state: u.scope_state }).catch(() => []);
        const orgIds = new Set((orgs || []).map(o => o.id));
        appList = allApps.filter(a => orgIds.has(a.organization_id));
      }
      setApplications(appList);
      setLoading(false);
    });
  }, []);

  const handleStatusChange = async (app, status) => {
    await base44.entities.Application.update(app.id, { status });
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status } : a));
    const emailMap = {
      Approved: {
        subject: `Application Approved - ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has been APPROVED.\n\nPlease log in to the GMT Portal to view the details and next steps.\n\nGrant Management Team`,
      },
      Denied: {
        subject: `Application Not Approved - ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has not been approved at this time.\n\nPlease log in to the GMT Portal for more information.\n\nGrant Management Team`,
      },
      RevisionRequested: {
        subject: `Revision Requested - ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nRevisions are required for your grant application (${app.application_number}).\n\nPlease log in to the GMT Portal to review the feedback and update your application.\n\nGrant Management Team`,
      },
    };
    if (emailMap[status] && app.submitted_by) {
      await base44.integrations.Core.SendEmail({ to: app.submitted_by, ...emailMap[status] });
    }
  };

  const filteredApps = applications.filter(a =>
    appFilter === 'all' ? true : a.status === appFilter
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Applications & Document Review</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage applications and document review settings.</p>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="doc-review"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Document Review</TabsTrigger>
        </TabsList>

        {/* APPLICATIONS TAB */}
        <TabsContent value="applications" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="UnderReview">Under Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Denied">Denied</SelectItem>
                <SelectItem value="RevisionRequested">Revision Requested</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filteredApps.length} applications</span>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="p-3 font-medium text-muted-foreground">Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map(app => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                      <td className="p-3 font-medium">{app.organization_name || ' - '}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{app.program_code || ' - '}</span></td>
                      <td className="p-3 text-right">{formatCurrency(app.requested_amount)}</td>
                      <td className="p-3"><StatusBadge status={app.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                      <td className="p-3">
                        <Select value={app.status} onValueChange={v => handleStatusChange(app, v)}>
                          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied'].map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                  {filteredApps.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No applications found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DOCUMENT REVIEW TAB */}
        <TabsContent value="doc-review" className="mt-4">
          <DocumentReviewSettings user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}