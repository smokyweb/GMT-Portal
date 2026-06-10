import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import StatusBadge from '../components/StatusBadge';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { formatDateShort, formatCurrency } from '../lib/helpers';
import { CheckCircle2, XCircle, FileText, Eye } from 'lucide-react';

export default function ReportsCompliance() {
  const [schedules, setSchedules] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Review dialog state
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [progressReport, setProgressReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const dateFilter = useDateRangeFilter();

  useEffect(() => {
    const loadData = async () => {
      const [u, allSchedules] = await Promise.all([
        base44.auth.me(),
        base44.entities.ReportSchedule.list('-due_date', 200),
      ]);
      setUser(u);
      let visible = allSchedules;
      if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
        if (u.role === 'admin' && u.scope_state) {
          // State admin: see schedules from orgs in their state
          const allOrgs = await base44.entities.Organization.list();
          const orgs = allOrgs.filter(o => o.state === u.scope_state);
          const orgIds = new Set(orgs.map(o => o.id));
          const appIds = new Set();
          const apps = await base44.entities.Application.list();
          apps.filter(a => orgIds.has(a.organization_id)).forEach(a => appIds.add(a.id));
          visible = allSchedules.filter(s => appIds.has(s.application_id));
        } else if (u.role === 'user' && u.organization_id) {
          // Subrecipient: see only schedules for their organization's applications
          const apps = await base44.entities.Application.list();
          const appIds = new Set(apps.filter(a => a.organization_id === u.organization_id).map(a => a.id));
          visible = allSchedules.filter(s => appIds.has(s.application_id));
        }
      }
      setSchedules(visible);
      setLoading(false);
    };
    loadData();
  }, []);

  const openReview = async (schedule) => {
    setSelectedSchedule(schedule);
    setReviewNotes('');
    setProgressReport(null);
    setLoadingReport(true);
    const reports = await base44.entities.ProgressReport.filter({ schedule_id: schedule.id }, '-created_date', 1);
    setProgressReport(reports[0] || null);
    setLoadingReport(false);
  };

  const handleDecision = async (decision) => {
    setSaving(true);
    const newScheduleStatus = decision === 'Approved' ? 'Approved' : 'Denied';
    const newReportStatus = decision === 'Approved' ? 'Approved' : 'Denied';

    await base44.entities.ReportSchedule.update(selectedSchedule.id, { status: newScheduleStatus });

    if (progressReport) {
      await base44.entities.ProgressReport.update(progressReport.id, {
        status: newReportStatus,
        reviewer_id: user?.email,
        reviewer_notes: reviewNotes,
      });
    }

    setSchedules(prev => prev.map(s => s.id === selectedSchedule.id ? { ...s, status: newScheduleStatus } : s));

    // Notify subrecipient
    if (selectedSchedule.application_id) {
      const apps = await base44.entities.Application.filter({ id: selectedSchedule.application_id });
      const app = apps[0];
      if (app?.submitted_by) {
        await base44.integrations.Core.SendEmail({
          to: app.submitted_by,
          subject: `Progress Report ${decision} – ${selectedSchedule.application_number}`,
          body: `Your ${selectedSchedule.report_type} progress report for grant ${selectedSchedule.application_number} has been ${decision.toLowerCase()} by the state office.\n\n${reviewNotes ? `Reviewer notes: ${reviewNotes}` : ''}\n\nLog in to the portal for details.`,
        });
      }
    }

    setSaving(false);
    setSelectedSchedule(null);
  };

  const { start: rangeStart, end: rangeEnd } = dateFilter.getEffectiveDateRange();

  const filtered = schedules.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (filterOrg !== 'all' && s.organization_name !== filterOrg) return false;
    if (filterProgram !== 'all' && s.program_code !== filterProgram) return false;
    if (filterType !== 'all' && s.report_type !== filterType) return false;
    if (rangeStart && s.due_date && new Date(s.due_date) < new Date(rangeStart)) return false;
    if (rangeEnd && s.due_date && new Date(s.due_date) > new Date(rangeEnd)) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const submittedCount = schedules.filter(s => s.status === 'Submitted').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor and review report schedules across all grants
          {submittedCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
              {submittedCount} awaiting review
            </span>
          )}
        </p>
      </div>

      <div className="space-y-4">
         <div className="flex flex-wrap gap-3">
           <Select value={filterOrg} onValueChange={setFilterOrg}>
             <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Organizations" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Organizations</SelectItem>
               {[...new Set(schedules.map(s => s.organization_name).filter(Boolean))].sort().map(o => (
                 <SelectItem key={o} value={o}>{o}</SelectItem>
               ))}
             </SelectContent>
           </Select>
           <Select value={filterStatus} onValueChange={setFilterStatus}>
             <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Statuses</SelectItem>
               <SelectItem value="Pending">Pending</SelectItem>
               <SelectItem value="Overdue">Overdue</SelectItem>
               <SelectItem value="Submitted">Submitted</SelectItem>
               <SelectItem value="Approved">Approved</SelectItem>
               <SelectItem value="Denied">Denied</SelectItem>
             </SelectContent>
           </Select>
           <Select value={filterProgram} onValueChange={setFilterProgram}>
             <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Programs</SelectItem>
               {[...new Set(schedules.map(s => s.program_code).filter(Boolean))].sort().map(p => (
                 <SelectItem key={p} value={p}>{p}</SelectItem>
               ))}
             </SelectContent>
           </Select>
           <Select value={filterType} onValueChange={setFilterType}>
             <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Types" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Types</SelectItem>
               <SelectItem value="Quarterly">Quarterly</SelectItem>
               <SelectItem value="Annual">Annual</SelectItem>
               <SelectItem value="Final">Final</SelectItem>
             </SelectContent>
           </Select>
           <Select value={dateFilter.dateMode} onValueChange={v => { dateFilter.setDateMode(v); dateFilter.setDateStart(''); dateFilter.setDateEnd(''); }}>
             <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
             <SelectContent>
               <SelectItem value="none">All Dates</SelectItem>
               <SelectItem value="fiscal">Fiscal Year</SelectItem>
               <SelectItem value="custom">Custom Range</SelectItem>
             </SelectContent>
           </Select>
           {dateFilter.dateMode === 'fiscal' && (
             <Select value={dateFilter.fiscalYear} onValueChange={dateFilter.setFiscalYear}>
               <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
               <SelectContent>
                 {(dateFilter.fyYearOptions || []).map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
               </SelectContent>
             </Select>
           )}
           {dateFilter.dateMode === 'custom' && (
             <>
               <input type="date" value={dateFilter.dateStart} onChange={e => dateFilter.setDateStart(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" title="Start date" />
               <input type="date" value={dateFilter.dateEnd} onChange={e => dateFilter.setDateEnd(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" title="End date" />
             </>
           )}
           {dateFilter.dateMode !== 'none' && (
             <Button variant="ghost" size="sm" onClick={() => dateFilter.reset()}>Clear dates</Button>
           )}
         </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className={`border-b last:border-0 hover:bg-muted/30 transition ${s.status === 'Submitted' ? 'bg-amber-50/40' : ''}`}>
                    <td className="p-3 font-mono text-xs">{s.application_number || '—'}</td>
                    <td className="p-3 font-medium">{s.organization_name || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{s.program_code || '—'}</span>
                    </td>
                    <td className="p-3">{s.report_type}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDateShort(s.period_start)} – {formatDateShort(s.period_end)}</td>
                    <td className="p-3 text-xs font-medium">{formatDateShort(s.due_date)}</td>
                    <td className="p-3"><StatusBadge status={s.status} /></td>
                    <td className="p-3">
                      <Button
                        variant={s.status === 'Submitted' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openReview(s)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {s.status === 'Submitted' ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No report schedules found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedSchedule} onOpenChange={() => setSelectedSchedule(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {selectedSchedule?.report_type} Progress Report
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Schedule info */}
            <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg p-3 text-sm">
              <div><span className="font-medium text-muted-foreground">Grant:</span> {selectedSchedule?.application_number}</div>
              <div><span className="font-medium text-muted-foreground">Organization:</span> {selectedSchedule?.organization_name}</div>
              <div><span className="font-medium text-muted-foreground">Program:</span> {selectedSchedule?.program_code}</div>
              <div><span className="font-medium text-muted-foreground">Due Date:</span> {formatDateShort(selectedSchedule?.due_date)}</div>
              <div><span className="font-medium text-muted-foreground">Period:</span> {formatDateShort(selectedSchedule?.period_start)} – {formatDateShort(selectedSchedule?.period_end)}</div>
              <div><span className="font-medium text-muted-foreground">Status:</span> <StatusBadge status={selectedSchedule?.status} /></div>
            </div>

            {/* Progress Report content */}
            {loadingReport ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : progressReport ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Progress Narrative</p>
                  <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{progressReport.narrative || '—'}</p>
                </div>
                {progressReport.objectives_met && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Performance Objectives Met</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{progressReport.objectives_met}</p>
                  </div>
                )}
                {progressReport.challenges && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Challenges & Corrective Actions</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{progressReport.challenges}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Expenditures This Period</p>
                    <p className="font-bold text-sm mt-0.5">{formatCurrency(progressReport.expenditure_ytd)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Match Documented</p>
                    <p className="font-bold text-sm mt-0.5">{formatCurrency(progressReport.match_ytd)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Submitted by {progressReport.submitted_by} on {formatDateShort(progressReport.submitted_at || progressReport.created_date)}</p>

                {/* Existing reviewer notes if already reviewed */}
                {progressReport.reviewer_notes && selectedSchedule?.status !== 'Submitted' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Reviewer Notes</p>
                    <p className="text-sm text-blue-900">{progressReport.reviewer_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No progress report content submitted yet.
              </div>
            )}

            {/* Review actions — only show if status is Submitted */}
            {selectedSchedule?.status === 'Submitted' && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label>Reviewer Notes (optional)</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="Add notes or feedback for the subrecipient…"
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedSchedule(null)}>Close</Button>
            {selectedSchedule?.status === 'Submitted' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleDecision('Denied')}
                  disabled={saving}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  {saving ? 'Saving…' : 'Deny'}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleDecision('Approved')}
                  disabled={saving}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {saving ? 'Saving…' : 'Approve'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}