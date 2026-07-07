import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StatusBadge from '../components/StatusBadge';
import RequiredTemplatesPanel from '@/components/RequiredTemplatesPanel';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { Paperclip, X, Loader2 } from 'lucide-react';

export default function MyReports() {
  const [schedules, setSchedules] = useState([]);
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    narrative: '', objectives_met: '', challenges: '', expenditure_ytd: 0, match_ytd: 0,
  });
  const [attachments, setAttachments] = useState([]); // [{ file, uploading, url, name }]
  const [viewReport, setViewReport] = useState(null);
  const [viewProgress, setViewProgress] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    if (u.organization_id) {
      const apps = await base44.entities.Application.filter({ organization_id: u.organization_id });
      const appIds = new Set(apps.map(a => a.id));
      const all = await base44.entities.ReportSchedule.list('-due_date', 100);
      setSchedules(all.filter(s => appIds.has(s.application_id)));
    }
    setLoading(false);
  };

  const openViewReport = async (schedule) => {
    setViewReport(schedule);
    const reports = await base44.entities.ProgressReport.filter({ schedule_id: schedule.id }, '-created_date', 1).catch(() => []);
    setViewProgress(reports[0] || null);
  };

  const openReport = (schedule) => {
    setSelected(schedule);
    setForm({ narrative: '', objectives_met: '', challenges: '', expenditure_ytd: 0, match_ytd: 0 });
    setAttachments([]);
    setOpen(true);
  };

  const uploadFileToServer = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('gmt_token');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) { const data = await res.json(); return data.url || ''; }
    } catch (e) { console.warn('Upload failed:', e.message); }
    return '';
  };

  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newItems = files.map(f => ({ file: f, uploading: true, url: null, name: f.name }));
    setAttachments(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      const file_url = await uploadFileToServer(item.file);
      setAttachments(prev => prev.map(a => a.name === item.name && a.uploading ? { ...a, uploading: false, url: file_url } : a));
    }
    e.target.value = '';
  };

  const removeAttachment = (name) => {
    setAttachments(prev => prev.filter(a => a.name !== name));
  };

  const submitReport = async () => {
    setSubmitting(true);
    // Upload any still-uploading files (wait)
    const readyAttachments = attachments.filter(a => a.url);

    await base44.entities.ProgressReport.create({
      schedule_id: selected.id,
      application_id: selected.application_id,
      submitted_by: user.email,
      ...form,
      expenditure_ytd: Number(form.expenditure_ytd),
      match_ytd: Number(form.match_ytd),
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
    });

    // Save documents linked to this application
    for (const att of readyAttachments) {
      await base44.entities.Document.create({
        name: att.name,
        doc_type: 'ProgressNarrative',
        file_url: att.url,
        uploaded_by: user.email,
        organization_id: user.organization_id,
        application_id: selected.application_id,
        application_number: selected.application_number,
        organization_name: selected.organization_name,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
      });
    }
    await base44.entities.ReportSchedule.update(selected.id, { status: 'Submitted' });

    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'Report Submitted',
        `${selected.organization_name} submitted a ${selected.report_type} report for ${selected.application_number}.`,
        'report_submitted', 'ProgressReport', selected.id, '/reports');
    }
    await logAudit(base44, user, 'Submitted', 'ProgressReport', selected.id, `Submitted ${selected.report_type} report for ${selected.application_number}`);
    setSubmitting(false);
    setOpen(false);
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Submit progress reports for your grants</p>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{s.application_number}</td>
                  <td className="p-3">{s.report_type}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(s.period_start)} - {formatDateShort(s.period_end)}</td>
                  <td className="p-3 text-xs font-medium">{formatDateShort(s.due_date)}</td>
                  <td className="p-3"><StatusBadge status={s.status} /></td>
                  <td className="p-3 flex gap-2 items-center">
                    {(s.status === 'Pending' || s.status === 'Overdue') && (
                      <Button size="sm" onClick={() => openReport(s)}>Submit Report</Button>
                    )}
                    {['Submitted','Approved','Denied','RevisionRequested'].includes(s.status) && (
                      <Button size="sm" variant="outline" onClick={() => openViewReport(s)}>View</Button>
                    )}
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No report schedules</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submit {selected?.report_type} Report</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p><strong>Grant:</strong> {selected.application_number}</p>
                <p><strong>Period:</strong> {formatDateShort(selected.period_start)} - {formatDateShort(selected.period_end)}</p>
              </div>
              <div><Label>Narrative</Label><Textarea value={form.narrative} onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))} rows={4} /></div>
              <div><Label>Objectives Met</Label><Textarea value={form.objectives_met} onChange={e => setForm(f => ({ ...f, objectives_met: e.target.value }))} rows={3} /></div>
              <div><Label>Challenges</Label><Textarea value={form.challenges} onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Expenditure This Period ($)</Label><Input type="number" value={form.expenditure_ytd} onChange={e => setForm(f => ({ ...f, expenditure_ytd: e.target.value }))} /></div>
                <div><Label>Match Documented ($)</Label><Input type="number" value={form.match_ytd} onChange={e => setForm(f => ({ ...f, match_ytd: e.target.value }))} /></div>
              </div>

              {/* Required Templates */}
              {selected.required_template_ids?.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/20">
                  <RequiredTemplatesPanel
                    entityType="ProgressReport"
                    entityId={selected.id}
                    requiredTemplateIds={selected.required_template_ids || []}
                    onUpdate={() => {}}
                    isAdmin={false}
                  />
                </div>
              )}

              {/* Attachments */}
              <div>
                <Label>Supporting Documents</Label>
                <div className="mt-2 space-y-2">
                  {attachments.map(a => (
                    <div key={a.name} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 text-sm">
                      {a.uploading
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                        : <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <span className="flex-1 truncate text-xs">{a.name}</span>
                      {!a.uploading && <span className="text-xs text-green-600 font-medium">Uploaded</span>}
                      <button onClick={() => removeAttachment(a.name)} className="text-muted-foreground hover:text-destructive transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition w-full"
                  >
                    <Paperclip className="h-4 w-4" /> Attach files
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitReport} disabled={submitting || attachments.some(a => a.uploading)}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View submitted report dialog */}
      {viewReport && (
        <Dialog open={!!viewReport} onOpenChange={o => { if (!o) { setViewReport(null); setViewProgress(null); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Report: {viewReport.report_type} - {viewReport.application_number}</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Period</p><p className="font-medium">{formatDateShort(viewReport.period_start)} - {formatDateShort(viewReport.period_end)}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={viewReport.status} /></div>
                <div><p className="text-xs text-muted-foreground">Due Date</p><p className="font-medium">{formatDateShort(viewReport.due_date)}</p></div>
                {viewProgress?.submitted_at && <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{formatDateShort(viewProgress.submitted_at)}</p></div>}
              </div>
              {viewProgress ? (
                <>
                  {viewProgress.narrative && <div><p className="text-xs text-muted-foreground font-medium">Narrative</p><p className="mt-1 bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{viewProgress.narrative}</p></div>}
                  {viewProgress.objectives_met && <div><p className="text-xs text-muted-foreground font-medium">Objectives Met</p><p className="mt-1 bg-muted/40 rounded-lg p-3">{viewProgress.objectives_met}</p></div>}
                  {viewProgress.challenges && <div><p className="text-xs text-muted-foreground font-medium">Challenges</p><p className="mt-1 bg-muted/40 rounded-lg p-3">{viewProgress.challenges}</p></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-muted-foreground">Expenditure YTD</p><p className="font-medium">{formatCurrency(viewProgress.expenditure_ytd)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Match YTD</p><p className="font-medium">{formatCurrency(viewProgress.match_ytd)}</p></div>
                  </div>
                  {viewProgress.reviewer_notes && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-xs font-semibold text-amber-800">Reviewer Notes</p><p className="text-sm text-amber-700 mt-1">{viewProgress.reviewer_notes}</p></div>}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-6">No report submitted yet.</p>
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => { setViewReport(null); setViewProgress(null); }}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}