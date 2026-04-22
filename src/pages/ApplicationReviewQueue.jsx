import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import StatusBadge from '../components/StatusBadge';
import ApplicationAuditTab from '../components/ApplicationAuditTab';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import moment from 'moment';

export default function ApplicationReviewQueue() {
  const [apps, setApps] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewScore, setReviewScore] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [revisionRequest, setRevisionRequest] = useState('');
  const [awardAmount, setAwardAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [a, u] = await Promise.all([
      base44.entities.Application.list('-created_date', 100),
      base44.auth.me(),
    ]);
    setApps(a);
    setUser(u);
    setLoading(false);
  };

  const openReview = async (app) => {
    const b = await base44.entities.ApplicationBudget.filter({ application_id: app.id });
    setBudgets(b);
    setSelected(app);
    setReviewScore(app.score || '');
    setReviewNotes('');
    setRevisionRequest('');
    setAwardAmount(app.requested_amount || '');
  };

  const handleApprove = async () => {
    const awarded = Number(awardAmount) || selected.requested_amount;
    await base44.entities.Application.update(selected.id, {
      status: 'Approved',
      awarded_amount: awarded,
      remaining_balance: awarded,
      total_expended: 0,
      expenditure_rate: 0,
    });
    await base44.entities.ApplicationReview.create({
      application_id: selected.id,
      reviewer_email: user.email,
      reviewer_name: user.full_name,
      action: 'Approved',
      score: Number(reviewScore) || null,
      notes: reviewNotes,
    });
    // Create report schedules
    if (selected.performance_start && selected.performance_end) {
      let current = moment(selected.performance_start);
      const end = moment(selected.performance_end);
      let qNum = 0;
      while (current.isBefore(end)) {
        const periodStart = current.format('YYYY-MM-DD');
        current.add(3, 'months');
        const periodEnd = current.isAfter(end) ? end.format('YYYY-MM-DD') : current.format('YYYY-MM-DD');
        qNum++;
        await base44.entities.ReportSchedule.create({
          application_id: selected.id,
          application_number: selected.application_number,
          organization_name: selected.organization_name,
          program_code: selected.program_code,
          report_type: 'Quarterly',
          period_start: periodStart,
          period_end: periodEnd,
          due_date: moment(periodEnd).add(30, 'days').format('YYYY-MM-DD'),
          status: 'Pending',
        });
      }
      await base44.entities.ReportSchedule.create({
        application_id: selected.id,
        application_number: selected.application_number,
        organization_name: selected.organization_name,
        program_code: selected.program_code,
        report_type: 'Annual',
        period_start: selected.performance_start,
        period_end: selected.performance_end,
        due_date: moment(selected.performance_end).add(60, 'days').format('YYYY-MM-DD'),
        status: 'Pending',
      });
    }
    await createNotification(base44, selected.submitted_by, 'Application Approved',
      `Your application ${selected.application_number} has been approved for ${formatCurrency(awarded)}.`,
      'app_approved', 'Application', selected.id, '/my-applications');
    await base44.integrations.Core.SendEmail({
      to: selected.submitted_by,
      subject: `Application Approved – ${selected.application_number}`,
      body: `Dear ${selected.organization_name},\n\nWe are pleased to inform you that your grant application (${selected.application_number}) for the ${selected.program_name || selected.program_code} program has been APPROVED.\n\nAwarded Amount: ${formatCurrency(awarded)}\n\nPlease log in to the GMT Portal to view the full details and next steps.\n\nThank you,\nGrant Management Team`,
    });
    await logAudit(base44, user, 'Approved', 'Application', selected.id,
      `Approved application ${selected.application_number} for ${formatCurrency(awarded)}`);
    setSelected(null);
    loadData();
  };

  const handleDeny = async () => {
    await base44.entities.Application.update(selected.id, { status: 'Denied' });
    await base44.entities.ApplicationReview.create({
      application_id: selected.id, reviewer_email: user.email, reviewer_name: user.full_name,
      action: 'Denied', score: Number(reviewScore) || null, notes: reviewNotes,
    });
    await createNotification(base44, selected.submitted_by, 'Application Denied',
      `Your application ${selected.application_number} has been denied.`,
      'app_denied', 'Application', selected.id, '/my-applications');
    await base44.integrations.Core.SendEmail({
      to: selected.submitted_by,
      subject: `Application Not Approved – ${selected.application_number}`,
      body: `Dear ${selected.organization_name},\n\nAfter careful review, your grant application (${selected.application_number}) for the ${selected.program_name || selected.program_code} program has not been approved at this time.\n\n${reviewNotes ? `Reviewer Notes: ${reviewNotes}\n\n` : ''}Please log in to the GMT Portal for more information.\n\nThank you,\nGrant Management Team`,
    });
    await logAudit(base44, user, 'Denied', 'Application', selected.id, `Denied application ${selected.application_number}`);
    setSelected(null);
    loadData();
  };

  const handleRevision = async () => {
    await base44.entities.Application.update(selected.id, { status: 'RevisionRequested', revision_notes: revisionRequest });
    await base44.entities.ApplicationReview.create({
      application_id: selected.id, reviewer_email: user.email, reviewer_name: user.full_name,
      action: 'RevisionRequested', notes: reviewNotes, revision_request: revisionRequest,
    });
    await createNotification(base44, selected.submitted_by, 'Revision Requested',
      `Revisions needed for application ${selected.application_number}: ${revisionRequest}`,
      'revision_requested', 'Application', selected.id, '/my-applications');
    await base44.integrations.Core.SendEmail({
      to: selected.submitted_by,
      subject: `Revision Requested – ${selected.application_number}`,
      body: `Dear ${selected.organization_name},\n\nYour grant application (${selected.application_number}) for the ${selected.program_name || selected.program_code} program requires revisions before it can be processed further.\n\nRevisions Needed:\n${revisionRequest}\n\nPlease log in to the GMT Portal to update and resubmit your application.\n\nThank you,\nGrant Management Team`,
    });
    await logAudit(base44, user, 'RevisionRequested', 'Application', selected.id, `Requested revision on ${selected.application_number}`);
    setSelected(null);
    loadData();
  };

  const toggleAllowable = async (budgetItem) => {
    await base44.entities.ApplicationBudget.update(budgetItem.id, { is_allowable: !budgetItem.is_allowable });
    setBudgets(prev => prev.map(b => b.id === budgetItem.id ? { ...b, is_allowable: !b.is_allowable } : b));
  };

  const filtered = apps.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterProgram !== 'all' && a.program_code !== filterProgram) return false;
    if (searchTerm && !a.organization_name?.toLowerCase().includes(searchTerm.toLowerCase())
      && !a.application_number?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Application Review Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and process grant applications</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by org or app #..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="UnderReview">Under Review</SelectItem>
            <SelectItem value="RevisionRequested">Revision Requested</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Denied">Denied</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {[...new Set(apps.map(a => a.program_code).filter(Boolean))].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-mono text-xs">{app.application_number || '—'}</td>
                  <td className="p-3 font-medium">{app.organization_name || '—'}</td>
                  <td className="p-3 max-w-[200px] truncate">{app.project_title || '—'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{app.program_code || '—'}</span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(app.requested_amount)}</td>
                  <td className="p-3"><StatusBadge status={app.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openReview(app)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Review
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No applications found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application {selected?.application_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <Tabs defaultValue="summary">
              <TabsList className="mb-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="budget">Budget</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Organization</Label>
                    <p className="font-medium">{selected.organization_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Program</Label>
                    <p className="font-medium">{selected.program_code} — {selected.program_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Requested Amount</Label>
                    <p className="font-bold text-lg">{formatCurrency(selected.requested_amount)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Match Commitment</Label>
                    <p className="font-medium">{formatCurrency(selected.match_amount)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Performance Period</Label>
                    <p className="font-medium">{formatDateShort(selected.performance_start)} – {formatDateShort(selected.performance_end)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Status</Label>
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Project Title</Label>
                  <p className="font-medium">{selected.project_title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Project Narrative</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.project_narrative || 'Not provided'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Work Plan</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.work_plan || 'Not provided'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Risk Assessment</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.risk_assessment || 'Not provided'}</p>
                </div>
              </TabsContent>

              <TabsContent value="budget">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Match</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Allowable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map(b => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{b.budget_category}</span>
                        </td>
                        <td className="p-3">{b.line_description}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(b.amount_requested)}</td>
                        <td className="p-3 text-right">{formatCurrency(b.amount_match)}</td>
                        <td className="p-3 text-center">
                          <Switch checked={b.is_allowable !== false} onCheckedChange={() => toggleAllowable(b)} />
                        </td>
                      </tr>
                    ))}
                    {budgets.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No budget items</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-bold">
                      <td className="p-3" colSpan={2}>Total</td>
                      <td className="p-3 text-right">{formatCurrency(budgets.reduce((s, b) => s + (b.amount_requested || 0), 0))}</td>
                      <td className="p-3 text-right">{formatCurrency(budgets.reduce((s, b) => s + (b.amount_match || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </TabsContent>

              <TabsContent value="documents">
                <p className="text-sm text-muted-foreground p-4">Document review will show uploaded files against NOFO requirements.</p>
              </TabsContent>

              <TabsContent value="audit">
                <ApplicationAuditTab applicationId={selected?.id} />
              </TabsContent>

              {/* Review Actions */}
              <div className="mt-6 border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Score (0–100)</Label>
                    <Input type="number" min={0} max={100} value={reviewScore} onChange={e => setReviewScore(e.target.value)} />
                  </div>
                  <div>
                    <Label>Award Amount ($)</Label>
                    <Input type="number" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Internal Notes</Label>
                  <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Revision Request (sent to subrecipient)</Label>
                  <Textarea value={revisionRequest} onChange={e => setRevisionRequest(e.target.value)} rows={2} placeholder="Describe changes needed..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeny}>Deny</Button>
                  <Button variant="secondary" onClick={handleRevision} disabled={!revisionRequest}>Request Revision</Button>
                  <Button onClick={handleApprove}>Approve</Button>
                </div>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}