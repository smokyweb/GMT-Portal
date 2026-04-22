import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, FileText, Upload, CheckCircle, AlertTriangle, Clock,
  Calendar, TrendingUp, Shield, ChevronRight, Download, Plus, Eye,
  Paperclip, Building2, X, Loader2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';

// ── Allocation Detail Panel ────────────────────────────────────────────────
function AllocationCard({ grant, onViewDetails }) {
  const expRate = grant.expenditure_rate || 0;
  const awarded = grant.awarded_amount || 0;
  const remaining = grant.remaining_balance || awarded;
  const expended = grant.total_expended || 0;

  const daysLeft = grant.performance_end
    ? Math.max(0, Math.ceil((new Date(grant.performance_end) - new Date()) / 86400000))
    : null;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-4 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{grant.project_title || 'Untitled Project'}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{grant.program_code}</span>
            <span className="text-xs text-muted-foreground font-mono">{grant.application_number}</span>
          </div>
        </div>
        <StatusBadge status={grant.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Awarded</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(awarded)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Expended</p>
          <p className="text-sm font-bold">{formatCurrency(expended)}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="text-sm font-bold text-blue-700">{formatCurrency(remaining)}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Expenditure Rate</span>
          <span className={expRate > 90 ? 'text-amber-600 font-medium' : ''}>{Math.round(expRate)}%</span>
        </div>
        <ExpenditureBar rate={expRate} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDateShort(grant.performance_start)} – {formatDateShort(grant.performance_end)}
        </span>
        {daysLeft !== null && (
          <span className={`flex items-center gap-1 font-medium ${daysLeft < 90 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3" /> {daysLeft}d left
          </span>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={() => onViewDetails(grant)}>
        <Eye className="h-3.5 w-3.5 mr-1.5" /> View Full Allocation Details
      </Button>
    </div>
  );
}

// ── Progress Report Form ───────────────────────────────────────────────────
function ProgressReportForm({ schedule, user, onSubmitted, onClose }) {
  const [form, setForm] = useState({
    narrative: '', objectives_met: '', challenges: '', expenditure_ytd: '', match_ytd: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newItems = files.map(f => ({ file: f, uploading: true, url: null, name: f.name }));
    setAttachments(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: item.file });
      setAttachments(prev => prev.map(a => a.name === item.name && a.uploading ? { ...a, uploading: false, url: file_url } : a));
    }
    e.target.value = '';
  };

  const removeAttachment = (name) => {
    setAttachments(prev => prev.filter(a => a.name !== name));
  };

  const handleSubmit = async () => {
    if (!form.narrative) return;
    setSubmitting(true);
    const report = await base44.entities.ProgressReport.create({
      schedule_id: schedule.id,
      application_id: schedule.application_id,
      submitted_by: user.email,
      narrative: form.narrative,
      objectives_met: form.objectives_met,
      challenges: form.challenges,
      expenditure_ytd: Number(form.expenditure_ytd) || 0,
      match_ytd: Number(form.match_ytd) || 0,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
    });

    // Save attached documents
    const readyAttachments = attachments.filter(a => a.url);
    for (const att of readyAttachments) {
      await base44.entities.Document.create({
        name: att.name,
        doc_type: 'ProgressNarrative',
        file_url: att.url,
        uploaded_by: user.email,
        organization_id: user.organization_id,
        application_id: schedule.application_id,
        application_number: schedule.application_number,
        organization_name: schedule.organization_name,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
        description: `Supporting document for ${schedule.report_type} report`,
      });
    }

    await base44.entities.ReportSchedule.update(schedule.id, { status: 'Submitted' });
    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'Report Submitted',
        `${schedule.organization_name} submitted a ${schedule.report_type} report for ${schedule.application_number}.`,
        'report_submitted', 'ProgressReport', report.id, '/reports');
    }
    await logAudit(base44, user, 'Submitted', 'ProgressReport', report.id,
      `Submitted ${schedule.report_type} report for ${schedule.application_number}`);
    setSubmitting(false);
    onSubmitted();
  };

  return (
    <Dialog open={!!schedule} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit {schedule?.report_type} Progress Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 grid grid-cols-2 gap-2">
            <div><span className="font-medium">Grant:</span> {schedule?.application_number}</div>
            <div><span className="font-medium">Program:</span> {schedule?.program_code}</div>
            <div><span className="font-medium">Period:</span> {formatDateShort(schedule?.period_start)} – {formatDateShort(schedule?.period_end)}</div>
            <div><span className="font-medium">Due:</span> {formatDateShort(schedule?.due_date)}</div>
          </div>
          <div>
            <Label>Progress Narrative <span className="text-red-500">*</span></Label>
            <Textarea className="mt-1" rows={5} placeholder="Describe activities completed during this reporting period, milestones achieved, and overall project progress..." value={form.narrative} onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))} />
          </div>
          <div>
            <Label>Performance Objectives Met</Label>
            <Textarea className="mt-1" rows={3} placeholder="List specific performance objectives achieved and supporting evidence..." value={form.objectives_met} onChange={e => setForm(f => ({ ...f, objectives_met: e.target.value }))} />
          </div>
          <div>
            <Label>Challenges &amp; Corrective Actions</Label>
            <Textarea className="mt-1" rows={3} placeholder="Describe any challenges encountered and steps taken or planned to address them..." value={form.challenges} onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Expenditures This Period ($)</Label>
              <Input className="mt-1" type="number" min="0" value={form.expenditure_ytd} onChange={e => setForm(f => ({ ...f, expenditure_ytd: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Match Documented ($)</Label>
              <Input className="mt-1" type="number" min="0" value={form.match_ytd} onChange={e => setForm(f => ({ ...f, match_ytd: e.target.value }))} placeholder="0.00" />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <Label>Supporting Documents (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">Attach evidence, invoices, photos, or other supporting materials.</p>
            <div className="space-y-2">
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
        <DialogFooter>
           <Button variant="outline" onClick={onClose}>Cancel</Button>
           <Button onClick={handleSubmit} disabled={submitting || attachments.some(a => a.uploading) || !form.narrative}>
             {submitting ? 'Submitting…' : 'Submit Report'}
           </Button>
         </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Upload Panel ──────────────────────────────────────────────────
function DocumentUploadSection({ apps, user, onUploaded }) {
  const [appId, setAppId] = useState('');
  const [docType, setDocType] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const DOC_TYPES = [
    'Invoice', 'PerformanceEvidence', 'Contract', 'BudgetJustification',
    'MatchDocumentation', 'ProgressNarrative', 'FinalReport', 'Other',
  ];

  useEffect(() => {
    if (!user?.organization_id) { setLoadingDocs(false); return; }
    base44.entities.Document.filter({ organization_id: user.organization_id }, '-created_date', 20)
      .then(docs => { setRecentDocs(docs); setLoadingDocs(false); });
  }, [user]);

  const handleUpload = async () => {
    if (!file || !appId || !docType) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const app = apps.find(a => a.id === appId);
    await base44.entities.Document.create({
      name: file.name,
      doc_type: docType,
      description,
      file_url,
      uploaded_by: user.email,
      uploaded_at: new Date().toISOString(),
      organization_id: user.organization_id,
      organization_name: app?.organization_name || '',
      application_id: appId,
      application_number: app?.application_number || '',
      review_status: 'Pending',
      version: 1,
    });
    await logAudit(base44, user, 'Uploaded', 'Document', appId,
      `Uploaded compliance document "${file.name}" for ${app?.application_number}`);

    // refresh
    const docs = await base44.entities.Document.filter({ organization_id: user.organization_id }, '-created_date', 20);
    setRecentDocs(docs);
    setFile(null); setAppId(''); setDocType(''); setDescription('');
    setUploading(false);
    onUploaded?.();
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Upload Compliance Document</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Grant / Application <span className="text-red-500">*</span></Label>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select grant…" /></SelectTrigger>
              <SelectContent>
                {apps.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.application_number || 'Draft'} — {a.project_title || a.program_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document Type <span className="text-red-500">*</span></Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description (optional)</Label>
          <Input className="mt-1" placeholder="Brief description of this document…" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div>
          <Label>File <span className="text-red-500">*</span></Label>
          <div className="mt-1 border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition cursor-pointer" onClick={() => document.getElementById('portal-file-input').click()}>
            <input id="portal-file-input" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <Paperclip className="h-4 w-4" /> {file.name}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                <Upload className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Click to choose a file (PDF, Word, Excel, images)
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleUpload} disabled={uploading || !file || !appId || !docType} className="w-full sm:w-auto">
          {uploading ? 'Uploading…' : 'Upload Document'}
        </Button>
      </div>

      {/* Recent Documents */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">My Uploaded Documents</h3>
          <Link to="/documents"><Button variant="ghost" size="sm">View All <ChevronRight className="h-3 w-3 ml-1" /></Button></Link>
        </div>
        {loadingDocs ? (
          <div className="flex items-center justify-center p-8"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">File Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Review Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Uploaded</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map(doc => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium max-w-[180px] truncate">{doc.name}</td>
                    <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">{doc.doc_type}</span></td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{doc.application_number || '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        doc.review_status === 'Approved' ? 'bg-green-50 text-green-700' :
                        doc.review_status === 'Rejected' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>{doc.review_status || 'Pending'}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDateShort(doc.uploaded_at || doc.created_date)}</td>
                    <td className="p-3">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {recentDocs.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No documents uploaded yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Allocation Detail Dialog ───────────────────────────────────────────────
function AllocationDetailDialog({ grant, onClose }) {
  if (!grant) return null;
  return (
    <Dialog open={!!grant} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{grant.project_title || 'Grant Allocation Details'}</DialogTitle>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{grant.program_code}</span>
            <span className="text-xs font-mono text-muted-foreground">{grant.application_number}</span>
            <StatusBadge status={grant.status} />
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* Financials */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Financial Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Awarded Amount', value: formatCurrency(grant.awarded_amount), color: 'text-green-700' },
                { label: 'Total Expended', value: formatCurrency(grant.total_expended), color: '' },
                { label: 'Remaining Balance', value: formatCurrency(grant.remaining_balance || grant.awarded_amount), color: 'text-blue-700' },
                { label: 'Match Committed', value: formatCurrency(grant.match_amount), color: '' },
                { label: 'Expenditure Rate', value: `${Math.round(grant.expenditure_rate || 0)}%`, color: '' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`font-bold text-sm ${color}`}>{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Performance Period</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-medium text-sm">{formatDateShort(grant.performance_start) || '—'}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="font-medium text-sm">{formatDateShort(grant.performance_end) || '—'}</p>
              </div>
            </div>
          </div>

          {/* Project Narrative */}
          {grant.project_narrative && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project Narrative</p>
              <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{grant.project_narrative}</p>
            </div>
          )}

          {/* Revision Notes */}
          {grant.revision_notes && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Revision Notes from Reviewer</p>
              <p className="text-sm text-orange-800">{grant.revision_notes}</p>
            </div>
          )}

          <ExpenditureBar rate={grant.expenditure_rate || 0} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SubrecipientPortal() {
  const [user, setUser] = useState(null);
  const [apps, setApps] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [tab, setTab] = useState('allocations');

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    if (!u.organization_id) { setLoading(false); return; }
    const [a, allSchedules, allFlags] = await Promise.all([
      base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 100),
      base44.entities.ReportSchedule.list('-due_date', 100),
      base44.entities.ComplianceFlag.list('-created_date', 50),
    ]);
    setApps(a);
    const appIds = new Set(a.map(x => x.id));
    setSchedules(allSchedules.filter(s => appIds.has(s.application_id)));
    setFlags(allFlags.filter(f => appIds.has(f.application_id) && !f.is_resolved));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user?.organization_id) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold mb-2">Organization Profile Required</h2>
      <p className="text-muted-foreground mb-4 max-w-md">Please set up your organization profile before using the subrecipient portal.</p>
      <Link to="/my-organization"><Button>Set Up Organization</Button></Link>
    </div>
  );

  const activeGrants = apps.filter(a => a.status === 'Approved');
  const allGrants = apps.filter(a => a.status !== 'Draft');
  const pendingReports = schedules.filter(s => s.status === 'Pending' || s.status === 'Overdue');
  const overdueReports = schedules.filter(s => s.status === 'Overdue');

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subrecipient Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your grant allocations, reports, and compliance documents</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/my-funding-requests?new=1">
            <Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1.5" /> Funding Request</Button>
          </Link>
          <Link to="/browse-nofos">
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Application</Button>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Grants', value: activeGrants.length, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: 'Total Awarded', value: formatCurrency(activeGrants.reduce((s, g) => s + (g.awarded_amount || 0), 0)), icon: DollarSign, color: 'bg-blue-50 text-blue-600' },
          { label: 'Reports Due', value: pendingReports.length, icon: FileText, color: overdueReports.length > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600' },
          { label: 'Compliance Flags', value: flags.length, icon: Shield, color: flags.length > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance Alert Banner */}
      {(overdueReports.length > 0 || flags.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Action Required</p>
            <p className="text-sm text-red-700 mt-0.5">
              {overdueReports.length > 0 && `${overdueReports.length} overdue report${overdueReports.length > 1 ? 's' : ''}. `}
              {flags.length > 0 && `${flags.length} open compliance flag${flags.length > 1 ? 's' : ''}.`}
              {' '}Please address these items to maintain good standing.
            </p>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="allocations" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Allocations
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Reports
            {pendingReports.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{pendingReports.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Documents
          </TabsTrigger>
        </TabsList>

        {/* ── ALLOCATIONS TAB ── */}
        <TabsContent value="allocations" className="mt-4 space-y-4">
          {activeGrants.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Active Grant Allocations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeGrants.map(grant => (
                  <AllocationCard key={grant.id} grant={grant} onViewDetails={setSelectedGrant} />
                ))}
              </div>
            </div>
          )}

          {allGrants.filter(g => g.status !== 'Approved').length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 mt-6 text-muted-foreground">Other Applications</h2>
              <div className="bg-card rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allGrants.filter(g => g.status !== 'Approved').map(app => (
                      <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                        <td className="p-3 font-medium">{app.project_title || '—'}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{app.program_code}</span></td>
                        <td className="p-3 text-right">{formatCurrency(app.requested_amount)}</td>
                        <td className="p-3"><StatusBadge status={app.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {allGrants.length === 0 && (
            <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No grant allocations yet</p>
              <p className="text-sm mt-1">Browse available NOFOs to apply for funding.</p>
              <Link to="/browse-nofos"><Button className="mt-4"><Plus className="h-4 w-4 mr-1.5" /> Browse NOFOs</Button></Link>
            </div>
          )}
        </TabsContent>

        {/* ── REPORTS TAB ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          {overdueReports.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-red-200">
                <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Overdue Reports</p>
              </div>
              <div className="divide-y divide-red-100">
                {overdueReports.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-red-800">{s.report_type} Report — {s.application_number}</p>
                      <p className="text-xs text-red-600">Was due {formatDateShort(s.due_date)} · {s.program_code}</p>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => setSelectedSchedule(s)}>Submit Now</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="p-4 border-b">
              <p className="font-semibold">All Report Schedules</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Report Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => {
                    const isOverdue = s.status === 'Overdue';
                    const isPending = s.status === 'Pending';
                    return (
                      <tr key={s.id} className={`border-b last:border-0 ${isOverdue ? 'bg-red-50/50' : 'hover:bg-muted/20'}`}>
                        <td className="p-3 font-mono text-xs">{s.application_number}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{s.program_code}</span></td>
                        <td className="p-3 font-medium">{s.report_type}</td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDateShort(s.period_start)} – {formatDateShort(s.period_end)}</td>
                        <td className={`p-3 text-xs font-medium ${isOverdue ? 'text-red-600' : ''}`}>{formatDateShort(s.due_date)}</td>
                        <td className="p-3"><StatusBadge status={s.status} /></td>
                        <td className="p-3">
                          {(isPending || isOverdue) && (
                            <Button size="sm" variant={isOverdue ? 'destructive' : 'default'} onClick={() => setSelectedSchedule(s)}>
                              Submit
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {schedules.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No report schedules. Reports are created when a grant application is approved.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── DOCUMENTS TAB ── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentUploadSection apps={allGrants} user={user} onUploaded={loadData} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AllocationDetailDialog grant={selectedGrant} onClose={() => setSelectedGrant(null)} />
      {selectedSchedule && (
        <ProgressReportForm
          schedule={selectedSchedule}
          user={user}
          onSubmitted={() => { setSelectedSchedule(null); loadData(); }}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}