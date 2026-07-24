import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/toast-simple';
import { useSearchParams } from 'react-router-dom';
import { getFYDateRange } from '../hooks/useDateRangeFilter';
import { base44 } from '@/api/base44Client';
import { Eye, Search, FileText, Lock } from 'lucide-react';
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
import ApplicationPdfExport from '../components/ApplicationPdfExport';
import AuditPackageExport from '../components/AuditPackageExport';
import ReviewHistory from '../components/ReviewHistory';
import AppLockedBanner from '../components/AppLockedBanner';
import { isAppLocked } from '../hooks/useAppLock';
import ComplianceChecklist from '../components/ComplianceChecklist';
import ContextualThread from '../components/ContextualThread';
import BudgetAmendmentReview from '../components/BudgetAmendmentReview';
import ReviewScoreCard from '../components/ReviewScoreCard';
import RfiPanel from '../components/RfiPanel';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import moment from 'moment';

export default function ApplicationReviewQueue() {
  const [searchParams] = useSearchParams();
  const [apps, setApps] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterOrg, setFilterOrg] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewScore, setReviewScore] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [scoreCardValues, setScoreCardValues] = useState({});
  const [nofos, setNofos] = useState([]);
  const [appTasks, setAppTasks] = useState([]);
  const [allOpenRfis, setAllOpenRfis] = useState({});  // map of app_id -> open RFI count
  const [revisionRequest, setRevisionRequest] = useState('');
  const [assignedReviewer, setAssignedReviewer] = useState('');
  const [reviewerUsers, setReviewerUsers] = useState([]);
  const [awardAmount, setAwardAmount] = useState('');
  const [viewApp, setViewApp] = useState(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dateMode, setDateMode] = useState('none'); // 'none', 'fiscal', 'custom'
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allApps, u, n] = await Promise.all([
      base44.entities.Application.list('-created_date', 100),
      base44.auth.me(),
      base44.entities.Nofo.list('-created_date', 200),
    ]);
    // Data isolation by role
    let visibleApps = allApps;
    let visibleNofos = n;
    if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
      if (u.role === 'admin' && u.scope_state) {
        // State admin: see applications from orgs in their state
        const orgs = await base44.entities.Organization.filter({ state: u.scope_state });
        const orgIds = new Set(orgs.map(o => o.id));
        visibleApps = allApps.filter(a => orgIds.has(a.organization_id));
        // Also filter NOFOs to those available to their state
        visibleNofos = n.filter(nofo =>
          !nofo.scope_states || nofo.scope_states.length === 0 || nofo.scope_states.includes(u.scope_state)
        );
      } else if (u.role === 'user' && u.organization_id) {
        // Subrecipient: see only their organization's applications
        visibleApps = allApps.filter(a => a.organization_id === u.organization_id);
      }
    }
    setApps(visibleApps);
    setUser(u);
    setNofos(visibleNofos);
    setLoading(false);
    // Load open RFIs for all apps to show badges in list
    base44.entities.Task.filter({ type: 'RFI' }, '-created_date', 500).then(tasks => {
      const rfiMap = {};
      (tasks || []).filter(t => !['Resolved','Cancelled'].includes(t.status)).forEach(t => {
        if (t.application_id) rfiMap[t.application_id] = (rfiMap[t.application_id] || 0) + 1;
      });
      setAllOpenRfis(rfiMap);
    }).catch(() => {});
    // Auto-open application from ?review= URL param
    const reviewId = searchParams.get('review');
    if (reviewId) {
      const target = visibleApps.find(a => a.id === reviewId);
      if (target) openReview(target);
    }
  };

  const openReview = async (app) => {
    const [b, t] = await Promise.all([
      base44.entities.ApplicationBudget.filter({ application_id: app.id }),
      base44.entities.Task.filter({ application_id: app.id }, '-created_date', 50),
    ]);
    setBudgets(b);
    setAppTasks(t);
    setSelected(app);
    setReviewScore(app.score || '');
    setReviewNotes('');
    setRevisionRequest('');
    setAssignedReviewer(app.internal_review_notes_reviewer || '');
    // Pre-fill with awarded_amount if already set, else use the latest amendment proposed_total, else requested_amount
setAwardAmount(Number(app.awarded_amount) || Number(app.requested_amount) || '');
    // Load reviewer users if not loaded
    if (reviewerUsers.length === 0) {
      base44.entities.User.list('-created_date', 200).then(users => {
        setReviewerUsers((users || []).filter(u => ['admin','reviewer','isc_admin'].includes(u.role)));
      }).catch(() => {});
    }
    setScoreCardValues({});
  };

  const handleClose = async () => {
    if (!window.confirm(`Close application ${selected.application_number}? This will lock it as read-only.`)) return;
    await base44.entities.Application.update(selected.id, {
      status: 'Closed',
      closed_at: new Date().toISOString(),
    });
    await logAudit(base44, user, 'Closed', 'Application', selected.id, `Closed application ${selected.application_number}`);
    setSelected(null);
    loadData();
  };

  const handleApprove = async () => {
    // Check if scoring is required for this NOFO
    const selectedNofo = nofos.find(n => n.id === selected?.nofo_id);
    const scoringRequired = !!selectedNofo?.scoring_enabled;
    const scoreNum = Number(reviewScore);
    if (scoringRequired) {
      if (reviewScore === '' || reviewScore === null || reviewScore === undefined) {
        toast('A review score is required before approving (scoring enabled). Please enter a score between 0 and 100.', 'error');
        return;
      }
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        toast('Score must be a number between 0 and 100.', 'warning');
        return;
      }
    }
    // Confirmation dialog
    const confirmed = window.confirm(
      `Approve application ${selected.application_number}?\n\nScore: ${scoreNum}/100\nAward Amount: $${Number(awardAmount) || selected.requested_amount}\n\nThis action will set the application status to Approved and cannot be undone.`
    );
    if (!confirmed) return;

    const awarded = Number(awardAmount) || selected.requested_amount;
    await base44.entities.Application.update(selected.id, {
      status: 'Approved',
      awarded_amount: awarded,
      remaining_balance: awarded,
      total_expended: 0,
      expenditure_rate: 0,
      ...(assignedReviewer ? { internal_review_notes_reviewer: assignedReviewer } : {}),
    });
    await base44.entities.ApplicationReview.create({
      application_id: selected.id,
      reviewer_email: user.email,
      reviewer_name: user.full_name,
      action: 'Approved',
      score: Number(reviewScore) || null,
      notes: reviewNotes,
    });
    if (reviewNotes) {
      await base44.entities.ReviewComment.create({
        entity_type: 'Application', entity_id: selected.id,
        reviewer_email: user.email, reviewer_name: user.full_name,
        comment: reviewNotes, action: 'Approved',
      }).catch(() => {});
    }
    // Create report schedules - DEDUPLICATION: only if none exist yet for this application
    if (selected.performance_start && selected.performance_end) {
      const existingSchedules = await base44.entities.ReportSchedule.filter({ application_id: selected.id }, '-due_date', 100).catch(() => []);
      if (!existingSchedules || existingSchedules.length === 0) {
        const start = moment(selected.performance_start);
        const end = moment(selected.performance_end);
        const grantMonths = end.diff(start, 'months', true); // true = floating point
        // Calculate exact number of full quarters within period
        const maxQuarters = Math.floor(grantMonths / 3);
        let current = start.clone();
        for (let q = 0; q < maxQuarters; q++) {
          const periodStart = current.format('YYYY-MM-DD');
          const nextQ = current.clone().add(3, 'months');
          const periodEnd = nextQ.isAfter(end) ? end.format('YYYY-MM-DD') : nextQ.format('YYYY-MM-DD');
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
          current = nextQ;
        }
        // Annual report only if grant is >= 12 months
        if (grantMonths >= 12) {
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
      }
    }
    await createNotification(base44, selected.submitted_by, 'Application Approved',
      `Your application ${selected.application_number} has been approved for ${formatCurrency(awarded)}.`,
      'app_approved', 'Application', selected.id, '/my-applications');
    await base44.integrations.Core.SendEmail({
      to: selected.submitted_by,
      subject: `Application Approved - ${selected.application_number}`,
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
      subject: `Application Not Approved - ${selected.application_number}`,
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
      subject: `Revision Requested - ${selected.application_number}`,
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

  const getEffectiveDateRange = () => {
    if (dateMode === 'fiscal') {
      // Use shared federal FY logic (Oct 1 - Sep 30)
      return getFYDateRange(`FY${fiscalYear}`);
    } else if (dateMode === 'custom') {
      return { start: dateStart, end: dateEnd };
    }
    return { start: null, end: null };
  };

  const { start: rangeStart, end: rangeEnd } = getEffectiveDateRange();

  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = apps.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterProgram !== 'all' && a.program_code !== filterProgram) return false;
    if (filterOrg !== 'all' && a.organization_name !== filterOrg) return false;
    if (rangeStart && a.submitted_at && new Date(a.submitted_at) < new Date(rangeStart)) return false;
    if (rangeEnd && a.submitted_at && new Date(a.submitted_at) > new Date(rangeEnd)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!a.organization_name?.toLowerCase().includes(q)
        && !a.application_number?.toLowerCase().includes(q)
        && !a.grant_number?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Application Review Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and process grant applications
          {user?.scope_state && <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{user.scope_state}</span>}
        </p>
      </div>

      {/* Create on Behalf of Subrecipient */}
      {user && ['admin','reviewer','isc_admin'].includes(user.role) && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <span className="text-blue-800 font-medium">Admin:</span>
          <a href="/new-application" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition">
            + Create Application on Behalf of Subrecipient
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by org, app #, or grant #..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
        <Select value={filterOrg} onValueChange={setFilterOrg}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Organizations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {[...new Set(apps.map(a => a.organization_name).filter(Boolean))].sort().map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateMode} onValueChange={v => { setDateMode(v); setDateStart(''); setDateEnd(''); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All Dates</SelectItem>
            <SelectItem value="fiscal">Fiscal Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {dateMode === 'fiscal' && (
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <SelectItem key={year} value={year.toString()}>{`FY ${year}-${year + 1}`}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        )}
        {dateMode === 'custom' && (
          <>
            <Input type="date" placeholder="Start Date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-[140px]" title="Start date" />
            <Input type="date" placeholder="End Date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-[140px]" title="End date" />
          </>
        )}
        </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Grant #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE).map(app => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-mono text-xs">{app.application_number || ' - '}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{app.grant_number || ' - '}</td>
                  <td className="p-3 font-medium">{app.organization_name || ' - '}</td>
                  <td className="p-3 max-w-[200px] truncate">{app.project_title || ' - '}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{app.program_code || ' - '}</span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(app.requested_amount)}</td>
                  <td className="p-3 text-right font-medium text-green-700">{app.awarded_amount ? formatCurrency(app.awarded_amount) : <span className="text-muted-foreground text-xs">-</span>}</td>
                  <td className="p-3"><div className="flex items-center gap-1"><StatusBadge status={app.status} />{allOpenRfis[app.id] ? <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold" title={allOpenRfis[app.id] + " open RFI(s)"}>RFI</span> : null}</div></td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                  <td className="p-3 flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewApp(app)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {app.submitted_at && (
                      <Button variant="ghost" size="sm" onClick={() => openReview(app)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No applications found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(filtered.length, (currentPage-1)*PAGE_SIZE+1)}–{Math.min(filtered.length, currentPage*PAGE_SIZE)} of {filtered.length} applications
            {filtered.length < apps.length && ` (${apps.length} total loaded)`}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted">← Prev</button>
            {Array.from({length: Math.ceil(filtered.length/PAGE_SIZE)}, (_,i) => i+1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)} className={`px-2 py-1 text-xs rounded border ${p===currentPage ? 'bg-primary text-white' : 'hover:bg-muted'}`}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length/PAGE_SIZE),p+1))} disabled={currentPage>=Math.ceil(filtered.length/PAGE_SIZE)} className="px-2 py-1 text-xs rounded border disabled:opacity-40 hover:bg-muted">Next →</button>
          </div>
        </div>
      </div>

      {/* View Dialog (read-only) */}
      <Dialog open={!!viewApp} onOpenChange={() => setViewApp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Application {viewApp?.application_number}</DialogTitle>
              <StatusBadge status={viewApp?.status} />
            </div>
          </DialogHeader>
          {viewApp && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground text-xs">Organization</Label><p className="font-medium">{viewApp.organization_name}</p></div>
                <div><Label className="text-muted-foreground text-xs">Program</Label><p className="font-medium">{viewApp.program_code} - {viewApp.program_name}</p></div>
                {viewApp.grant_number && <div><Label className="text-muted-foreground text-xs">Grant Number</Label><p className="font-medium font-mono">{viewApp.grant_number}</p></div>}
                <div><Label className="text-muted-foreground text-xs">Requested Amount</Label><p className="font-bold text-lg">{formatCurrency(viewApp.requested_amount)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Match Commitment</Label><p className="font-medium">{formatCurrency(viewApp.match_amount)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Performance Period</Label><p className="font-medium">{formatDateShort(viewApp.performance_start)} - {formatDateShort(viewApp.performance_end)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Submitted</Label><p className="font-medium">{formatDateShort(viewApp.submitted_at)}</p></div>
              </div>
              <div><Label className="text-muted-foreground text-xs">Project Title</Label><p className="font-medium">{viewApp.project_title}</p></div>
              <div><Label className="text-muted-foreground text-xs">Project Narrative</Label><p className="whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewApp.project_narrative || 'Not provided'}</p></div>
              <div><Label className="text-muted-foreground text-xs">Work Plan</Label><p className="whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewApp.work_plan || 'Not provided'}</p></div>
              <div><Label className="text-muted-foreground text-xs">Risk Assessment</Label><p className="whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewApp.risk_assessment || 'Not provided'}</p></div>
              {viewApp.revision_notes && (
                <div><Label className="text-muted-foreground text-xs">Revision Notes</Label><p className="whitespace-pre-wrap bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg">{viewApp.revision_notes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Review Application {selected?.application_number}</DialogTitle>
              <div className="flex items-center gap-2">
                <AuditPackageExport application={selected} />
                <ApplicationPdfExport app={selected} budgets={budgets} />
              </div>
            </div>
          </DialogHeader>
          {selected && (() => {
            const nofo = nofos.find(n => n.id === selected.nofo_id);
            const scoringEnabled = !!nofo?.scoring_enabled;
            const openRfis = appTasks.filter(t => t.type === 'RFI' && !['Resolved', 'Cancelled'].includes(t.status));
            const hasBlockingRfis = openRfis.length > 0;
            const locked = isAppLocked(selected);
            return (
            <>
            <AppLockedBanner status={selected?.status} />
            <Tabs defaultValue="summary">
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                {scoringEnabled && <TabsTrigger value="scoring">Scoring</TabsTrigger>}
                <TabsTrigger value="budget">Budget</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="rfi">
                  RFIs {openRfis.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{openRfis.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="amendments">Amendments</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
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
                    <p className="font-medium">{selected.program_code} - {selected.program_name}</p>
                  </div>
                  {selected.grant_number && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Grant Number</Label>
                      <p className="font-medium font-mono">{selected.grant_number}</p>
                    </div>
                  )}
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
                    <p className="font-medium">{formatDateShort(selected.performance_start)} - {formatDateShort(selected.performance_end)}</p>
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

                {/* EHP Status */}
                {selected.ehp_status && selected.ehp_status !== 'NotRequired' && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-800">EHP Review Required</p>
                    <p className="text-xs text-amber-700 mt-0.5">Status: {selected.ehp_status} {selected.ehp_notes && ` - ${selected.ehp_notes}`}</p>
                  </div>
                )}

                {/* Program-specific highlights */}
                {selected.ij_title && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Investment Justification</Label>
                    <p className="font-medium text-sm">{selected.ij_title}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.ij_description || 'Not provided'}</p>
                  </div>
                )}
                {selected.thira_spr_alignment && (
                  <div>
                    <Label className="text-muted-foreground text-xs">THIRA/SPR Alignment</Label>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.thira_spr_alignment}</p>
                  </div>
                )}
                {selected.nsgp_vulnerability_assessment && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Vulnerability Assessment</Label>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.nsgp_vulnerability_assessment}</p>
                  </div>
                )}
                {selected.slcgp_cybersecurity_plan && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Cybersecurity Plan</Label>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selected.slcgp_cybersecurity_plan}</p>
                  </div>
                )}
                {selected.procurement_method && selected.procurement_method !== 'NotApplicable' && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Procurement Method</Label>
                    <p className="text-sm font-medium">{selected.procurement_method}
                      {selected.procurement_amount ? ` - ${formatCurrency(selected.procurement_amount)}` : ''}
                    </p>
                    {selected.procurement_justification && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/50 p-2 rounded-lg">{selected.procurement_justification}</p>
                    )}
                  </div>
                )}
              </TabsContent>

              {scoringEnabled && (
                <TabsContent value="scoring">
                  <ReviewScoreCard
                    programCode={selected?.program_code}
                    scores={scoreCardValues}
                    onChange={setScoreCardValues}
                  />
                </TabsContent>
              )}

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
                      <td className="p-3 text-right">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.amount_requested) || 0), 0))}</td>
                      <td className="p-3 text-right">{formatCurrency(budgets.reduce((s, b) => s + (Number(b.amount_match) || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </TabsContent>

              <TabsContent value="rfi">
                <RfiPanel
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  submittedBy={selected.submitted_by}
                  user={user}
                  isAdmin={true}
                  onRefresh={async () => {
                    const t = await base44.entities.Task.filter({ application_id: selected.id }, '-created_date', 50).catch(() => []);
                    setAppTasks(t);
                  }}
                />
              </TabsContent>

              <TabsContent value="documents">
                <ComplianceChecklist
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  user={user}
                  canUpload={false}
                  nofo={nofo}
                />
              </TabsContent>

              <TabsContent value="amendments">
                <BudgetAmendmentReview applicationId={selected?.id} isAdmin={true} />
              </TabsContent>

              <TabsContent value="messages">
                <ContextualThread
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  programCode={selected.program_code}
                  user={user}
                />
              </TabsContent>

              <TabsContent value="audit">
                <ApplicationAuditTab applicationId={selected?.id} />
              </TabsContent>

              {/* Review Actions */}
              <div className="mt-6 border-t pt-4 space-y-4">
                {!locked && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Score (0 - 100) {scoringEnabled && <span className="text-red-500">*</span>}{!scoringEnabled && <span className="text-xs text-muted-foreground">(optional)</span>}</Label>
                        <Input
                          type="number" min={0} max={100}
                          value={reviewScore}
                          onChange={e => setReviewScore(e.target.value)}
                          className={(Number(reviewScore) < 0 || Number(reviewScore) > 100) ? 'border-red-500' : ''}
                          placeholder={scoringEnabled ? 'Required for approval' : 'Optional'}
                        />
                        {reviewScore !== '' && (Number(reviewScore) < 0 || Number(reviewScore) > 100) && (
                          <p className="text-xs text-red-500 mt-1">Score must be between 0 and 100</p>
                        )}
                      </div>
                      <div>
                        <Label>Award Amount ($)</Label>
                        <Input type="number" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} />
                      </div>
                      <div>
                        <Label>Assign Reviewer</Label>
                        <select value={assignedReviewer} onChange={e => setAssignedReviewer(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none">
                          <option value="">Unassigned</option>
                          {reviewerUsers.map(u => <option key={u.id} value={u.email}>{u.full_name || u.email} ({u.role})</option>)}
                        </select>
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
                    {hasBlockingRfis && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                        ⚠ Approval blocked: {openRfis.length} open RFI{openRfis.length !== 1 ? 's' : ''} must be resolved before approving.
                      </div>
                    )}
                  </>
                )}
                {/* Review History */}
                <ReviewHistory
                  entityType="Application"
                  entityId={selected?.id}
                  user={user}
                  readOnly={locked}
                  className="mt-2 pt-3 border-t"
                />

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  {!locked && (
                    <>
                      <Button variant="destructive" onClick={handleDeny}>Deny</Button>
                      <Button variant="secondary" onClick={handleRevision} disabled={!revisionRequest}>Request Revision</Button>
                      {selected?.status === 'Approved' && (
                        <Button variant="outline" className="border-slate-400 text-slate-700" onClick={handleClose}>
                          <Lock className="h-3.5 w-3.5 mr-1" /> Close & Lock
                        </Button>
                      )}
                      <Button
                        onClick={handleApprove}
                        disabled={hasBlockingRfis || (scoringEnabled && (reviewScore === '' || reviewScore === null || isNaN(Number(reviewScore)) || Number(reviewScore) < 0 || Number(reviewScore) > 100))}
                        title={hasBlockingRfis ? 'Resolve all open RFIs first' : (scoringEnabled && reviewScore === '' ? 'Enter a score (0-100) before approving' : '')}
                      >Approve</Button>
                    </>
                  )}
                </div>
              </div>
            </Tabs>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}