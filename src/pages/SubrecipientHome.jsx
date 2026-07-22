import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, FileText, Upload, CheckCircle, AlertTriangle, Clock,
  Calendar, Shield, ChevronRight, Download, Plus, Eye,
  Paperclip, Building2, X, Loader2, Search, CircleDot, Inbox,
  MessageSquare, PenLine, CheckSquare, Send, ClipboardList,
  Flag, Zap, ArrowRight, MailOpen, Reply, FileEdit
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ExpenditureBar from '../components/ExpenditureBar';
import PortalAnalyticsTab from '../components/PortalAnalyticsTab';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';

// ── Compliance Flag Action Row ──────────────────────────────────────────────
function FlagActionRow({ flag, user, onResolved }) {
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) return;
    setSubmitting(true);
    try {
      await base44.entities.ComplianceFlag.update(flag.id, {
        subrecipient_response: responseText.trim(),
        response_submitted_at: new Date().toISOString(),
        response_submitted_by: user?.email,
        status: 'PendingReview',
      });
      // Notify state admin
      const allUsers = await base44.entities.User.list('-created_date', 100).catch(() => []);
      const admins = (allUsers || []).filter(u => ['admin','reviewer','isc_admin'].includes(u.role));
      for (const admin of admins) {
        base44.entities.Notification.create({
          user_email: admin.email,
          title: `Compliance Flag Response: ${flag.application_number}`,
          message: `${user?.full_name || user?.email} responded to a compliance flag on ${flag.application_number}: "${responseText.substring(0, 80)}"`,
          type: 'compliance_response',
          is_read: false,
        }).catch(() => {});
      }
      setResponding(false);
      setResponseText('');
      onResolved();
    } catch (err) {
      alert('Failed to submit response: ' + (err?.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}</p>
          <p className="text-xs text-red-600 mt-0.5">{flag.description}</p>
          <p className="text-xs text-muted-foreground mt-1">{flag.application_number} &bull; Severity: {flag.severity}</p>
          {flag.subrecipient_response && (
            <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-800">
              <span className="font-semibold">Your Response: </span>{flag.subrecipient_response}
              <span className="text-blue-500 ml-2">(Pending Review)</span>
            </div>
          )}
        </div>
        {!flag.subrecipient_response && (
          <button
            onClick={() => setResponding(r => !r)}
            className="text-xs text-primary hover:underline font-medium flex-shrink-0"
          >{responding ? 'Cancel' : 'Respond / Take Action'}</button>
        )}
      </div>
      {responding && (
        <div className="ml-7 space-y-2">
          <textarea
            className="w-full text-sm border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            placeholder="Describe the corrective action you have taken or plan to take to resolve this compliance issue..."
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
          />
          <button
            className="text-xs bg-primary text-white px-3 py-1.5 rounded-md font-medium disabled:opacity-50"
            disabled={submitting || !responseText.trim()}
            onClick={handleSubmitResponse}
          >{submitting ? 'Submitting...' : 'Submit Response'}</button>
        </div>
      )}
    </div>
  );
}

// ── NOFO Card ─────────────────────────────────────────────────────────────
function NofoCard({ nofo, orgType, onApply }) {
  const daysLeft = nofo.close_date
    ? Math.max(0, Math.ceil((new Date(nofo.close_date) - new Date()) / 86400000))
    : null;
  const isEligible = !nofo.eligible_org_types?.length || nofo.eligible_org_types.includes(orgType);
  const urgent = daysLeft !== null && daysLeft <= 14;

  return (
    <div className={`relative bg-card border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${!isEligible ? 'opacity-60' : ''} ${urgent ? 'border-red-200' : ''}`}>
      {urgent && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-orange-400 rounded-t-2xl" />}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug">{nofo.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-wide">{nofo.program_code || ' - '}</span>
            {nofo.grant_number && <span className="text-xs font-mono text-muted-foreground">{nofo.grant_number}</span>}
          </div>
        </div>
        {daysLeft !== null && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${urgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-50 text-amber-700'}`}>
            {daysLeft}d left
          </span>
        )}
      </div>
      {nofo.summary && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{nofo.summary}</p>}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded-xl p-2.5">
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide font-medium">Max Award</p>
          <p className="font-bold text-sm mt-0.5">{nofo.max_award ? formatCurrency(nofo.max_award) : ' - '}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2.5">
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide font-medium">Closes</p>
          <p className="font-bold text-sm mt-0.5">{formatDateShort(nofo.close_date) || ' - '}</p>
        </div>
      </div>
      {nofo.federal_agency && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" />{nofo.federal_agency}</p>
      )}
      {!isEligible ? (
        <p className="text-xs text-muted-foreground text-center py-1 bg-muted/40 rounded-lg">Not eligible for your organization type</p>
      ) : (
        <Button size="sm" className="w-full mt-1 shadow-sm" onClick={() => onApply(nofo)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Start Application
        </Button>
      )}
    </div>
  );
}

// ── Allocation Card ────────────────────────────────────────────────────────
function AllocationCard({ grant, onViewDetails }) {
  const expRate = grant.expenditure_rate || 0;
  const awarded = Number(grant.awarded_amount) || 0;
  const expended = Number(grant.total_expended) || 0;
  // Calculate remaining dynamically (DB field may be stale)
  const remaining = awarded - expended;
  const daysLeft = grant.performance_end
    ? Math.max(0, Math.ceil((new Date(grant.performance_end) - new Date()) / 86400000))
    : null;
  const nearExpiry = daysLeft !== null && daysLeft < 90;
  const highSpend = expRate > 85;

  return (
    <div className="bg-card rounded-2xl border p-5 space-y-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate group-hover:text-primary transition-colors">{grant.project_title || 'Untitled Project'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-wide">{grant.program_code}</span>
            <span className="text-xs text-muted-foreground font-mono">{grant.application_number}</span>
          </div>
        </div>
        <StatusBadge status={grant.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-xl p-2.5">
          <p className="text-[11px] text-green-600 font-medium uppercase tracking-wide">Awarded</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">{formatCurrency(awarded)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Expended</p>
          <p className="text-sm font-bold mt-0.5">{formatCurrency(expended)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2.5">
          <p className="text-[11px] text-blue-600 font-medium uppercase tracking-wide">Balance</p>
          <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(remaining)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Expenditure Rate</span>
          <span className={`font-semibold ${highSpend ? 'text-amber-600' : 'text-foreground'}`}>{Math.round(expRate)}%</span>
        </div>
        <ExpenditureBar rate={expRate} />
        {highSpend && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> High spend rate - review budget</p>}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDateShort(grant.performance_start)} - {formatDateShort(grant.performance_end)}
        </span>
        {daysLeft !== null && (
          <span className={`flex items-center gap-1 font-semibold ${nearExpiry ? 'text-amber-600' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3" /> {daysLeft}d remaining
          </span>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full group-hover:border-primary/40 transition-colors" onClick={() => onViewDetails(grant)}>
        <Eye className="h-3.5 w-3.5 mr-1.5" /> View Full Details
      </Button>
    </div>
  );
}

// ── Progress Report Form ───────────────────────────────────────────────────
function ProgressReportForm({ schedule, user, onSubmitted, onClose }) {
  const [form, setForm] = useState({ narrative: '', objectives_met: '', challenges: '', expenditure_ytd: '', match_ytd: '' });
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const fileInputRef = useRef(null);

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

  const handleSubmit = async () => {
    const errs = {};
    if (!form.narrative.trim()) errs.narrative = 'Progress narrative is required.';
    if (!form.expenditure_ytd) errs.expenditure_ytd = 'Please enter an expenditure amount (enter 0 if none).';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
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
    for (const att of attachments.filter(a => a.url)) {
      await base44.entities.Document.create({
        name: att.name, doc_type: 'ProgressNarrative', file_url: att.url,
        uploaded_by: user.email, organization_id: user.organization_id,
        application_id: schedule.application_id, application_number: schedule.application_number,
        organization_name: schedule.organization_name, review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
      });
    }
    await base44.entities.ReportSchedule.update(schedule.id, { status: 'Submitted' });
    const users = await base44.entities.User.list();
    for (const r of users.filter(u => u.role === 'admin' || u.role === 'reviewer')) {
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
        <DialogHeader><DialogTitle>Submit {schedule?.report_type} Progress Report</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 grid grid-cols-2 gap-2">
            <div><span className="font-medium">Grant:</span> {schedule?.application_number}</div>
            <div><span className="font-medium">Program:</span> {schedule?.program_code}</div>
            <div><span className="font-medium">Period:</span> {formatDateShort(schedule?.period_start)} - {formatDateShort(schedule?.period_end)}</div>
            <div><span className="font-medium">Due:</span> {formatDateShort(schedule?.due_date)}</div>
          </div>
          <div>
            <Label>Progress Narrative <span className="text-red-500">*</span></Label>
            <Textarea className={`mt-1 ${formErrors.narrative ? 'border-red-400 focus:ring-red-400' : ''}`} rows={5} placeholder="Describe activities completed during this reporting period..." value={form.narrative} onChange={e => { setForm(f => ({ ...f, narrative: e.target.value })); setFormErrors(p => ({ ...p, narrative: null })); }} />
            {formErrors.narrative && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{formErrors.narrative}</p>}
          </div>
          <div>
            <Label>Performance Objectives Met</Label>
            <Textarea className="mt-1" rows={3} placeholder="List key objectives that were met…" value={form.objectives_met} onChange={e => setForm(f => ({ ...f, objectives_met: e.target.value }))} />
          </div>
          <div>
            <Label>Challenges &amp; Corrective Actions</Label>
            <Textarea className="mt-1" rows={3} placeholder="Describe any challenges and how they were addressed…" value={form.challenges} onChange={e => setForm(f => ({ ...f, challenges: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Expenditures This Period ($) <span className="text-red-500">*</span></Label>
              <Input className={`mt-1 ${formErrors.expenditure_ytd ? 'border-red-400' : ''}`} type="number" min="0" value={form.expenditure_ytd} onChange={e => { setForm(f => ({ ...f, expenditure_ytd: e.target.value })); setFormErrors(p => ({ ...p, expenditure_ytd: null })); }} placeholder="0.00" />
              {formErrors.expenditure_ytd && <p className="text-xs text-red-500 mt-1">{formErrors.expenditure_ytd}</p>}
            </div>
            <div>
              <Label>Match Documented ($)</Label>
              <Input className="mt-1" type="number" min="0" value={form.match_ytd} onChange={e => setForm(f => ({ ...f, match_ytd: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Supporting Documents (optional)</Label>
            <div className="mt-2 space-y-2">
              {attachments.map(a => (
                <div key={a.name} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 text-sm">
                  {a.uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" /> : <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <span className="flex-1 truncate text-xs">{a.name}</span>
                  {!a.uploading && <span className="text-xs text-green-600 font-medium">Uploaded</span>}
                  <button onClick={() => setAttachments(prev => prev.filter(x => x.name !== a.name))}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 transition w-full">
                <Paperclip className="h-4 w-4" /> Attach files
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || attachments.some(a => a.uploading)} className="min-w-[130px]">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Allocation Detail Dialog ───────────────────────────────────────────────
function AllocationDetailDialog({ grant, onClose }) {
  const [lineItems, setLineItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!grant) return;
    setLoadingItems(true);
    base44.entities.FundingRequest.filter({ application_id: grant.id }, '-created_date', 100)
      .then(async (frs) => {
        if (!frs.length) { setLineItems([]); setLoadingItems(false); return; }
        const allItems = await Promise.all(frs.map(f => base44.entities.FundingRequestLineItem.filter({ funding_request_id: f.id })));
        setLineItems(allItems.flat());
        setLoadingItems(false);
      });
  }, [grant?.id]);

  if (!grant) return null;
  const byCategory = lineItems.reduce((acc, li) => {
    const cat = li.budget_category || 'Other';
    acc[cat] = (acc[cat] || 0) + (Number(li.amount) || 0);
    return acc;
  }, {});
  const totalLineItems = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);

  return (
    <Dialog open={!!grant} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{grant.project_title || 'Grant Allocation Details'}</DialogTitle>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{grant.program_code}</span>
            <span className="text-xs font-mono text-muted-foreground">{grant.application_number}</span>
            <StatusBadge status={grant.status} />
          </div>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Financial Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Awarded Amount', value: formatCurrency(grant.awarded_amount), color: 'text-green-700' },
                { label: 'Total Expended', value: formatCurrency(grant.total_expended), color: '' },
                { label: 'Remaining Balance', value: formatCurrency((Number(grant.awarded_amount)||0) - (Number(grant.total_expended)||0)), color: 'text-blue-700' },
                { label: 'Match Committed', value: formatCurrency(grant.match_amount), color: '' },
                { label: 'Expenditure Rate', value: `${Math.round(Number(grant.expenditure_rate) || 0)}%`, color: '' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`font-bold text-sm ${color}`}>{value || ' - '}</p>
                </div>
              ))}
            </div>
            <div className="mt-3"><ExpenditureBar rate={grant.expenditure_rate || 0} /></div>
          </div>
          {(grant.project_narrative || grant.revision_notes) && (
            <div className="space-y-3">
              {grant.project_narrative && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project Narrative</p>
                  <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{grant.project_narrative}</p>
                </div>
              )}
              {grant.revision_notes && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Revision Notes from Reviewer</p>
                  <p className="text-sm text-orange-800">{grant.revision_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Upload Section ────────────────────────────────────────────────
function DocumentUploadSection({ apps, user, onUploaded }) {
  const [appId, setAppId] = useState('');
  const [docType, setDocType] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [errors, setErrors] = useState({});

  const DOC_TYPES = ['Invoice', 'PerformanceEvidence', 'Contract', 'BudgetJustification', 'MatchDocumentation', 'ProgressNarrative', 'FinalReport', 'Other'];

  useEffect(() => {
    if (!user?.organization_id) { setLoadingDocs(false); return; }
    base44.entities.Document.filter({ organization_id: user.organization_id }, '-created_date', 20)
      .then(docs => { setRecentDocs(docs); setLoadingDocs(false); });
  }, [user]);

  const validate = () => {
    const e = {};
    if (!appId) e.appId = 'Please select a grant.';
    if (!docType) e.docType = 'Please select a document type.';
    if (!file) e.file = 'Please choose a file.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpload = async () => {
    if (!validate()) return;
    setUploading(true);
    setUploadProgress(20);
    let file_url = '';
    try {
      file_url = await uploadFileToServer(file);
      if (!file_url) { alert('Upload failed - could not get file URL. Please try again.'); setUploading(false); setUploadProgress(0); return; }
    } catch(uploadErr) { alert('Upload failed: ' + uploadErr.message); setUploading(false); setUploadProgress(0); return; }
    setUploadProgress(70);
    const app = apps.find(a => a.id === appId);
    await base44.entities.Document.create({
      name: file.name, doc_type: docType, description, file_url,
      uploaded_by: user.email, uploaded_at: new Date().toISOString(),
      organization_id: user.organization_id, organization_name: app?.organization_name || '',
      application_id: appId, application_number: app?.application_number || '',
      review_status: 'Pending', version: 1,
    });
    setUploadProgress(90);
    await logAudit(base44, user, 'Uploaded', 'Document', appId, `Uploaded "${file.name}" for ${app?.application_number}`);
    const docs = await base44.entities.Document.filter({ organization_id: user.organization_id }, '-created_date', 20);
    setRecentDocs(docs);
    setFile(null); setAppId(''); setDocType(''); setDescription(''); setErrors({});
    setUploadProgress(100);
    setTimeout(() => { setUploadProgress(0); setUploading(false); }, 600);
    onUploaded?.();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) { setFile(dropped); setErrors(prev => ({ ...prev, file: null })); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border p-6 space-y-5">
        <h3 className="font-semibold flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-primary" /> Upload Compliance Document</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Grant / Application <span className="text-red-500">*</span></Label>
            <Select value={appId} onValueChange={v => { setAppId(v); setErrors(p => ({ ...p, appId: null })); }}>
              <SelectTrigger className={`mt-1 ${errors.appId ? 'border-red-400' : ''}`}><SelectValue placeholder="Select grant…" /></SelectTrigger>
              <SelectContent>
                {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.application_number || 'Draft'} - {a.project_title || a.program_code}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.appId && <p className="text-xs text-red-500 mt-1">{errors.appId}</p>}
          </div>
          <div>
            <Label>Document Type <span className="text-red-500">*</span></Label>
            <Select value={docType} onValueChange={v => { setDocType(v); setErrors(p => ({ ...p, docType: null })); }}>
              <SelectTrigger className={`mt-1 ${errors.docType ? 'border-red-400' : ''}`}><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            {errors.docType && <p className="text-xs text-red-500 mt-1">{errors.docType}</p>}
          </div>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Input className="mt-1" placeholder="Brief description…" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>File <span className="text-red-500">*</span></Label>
          <div
            className={`mt-1 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
              ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : errors.file ? 'border-red-400 bg-red-50/30' : 'hover:border-primary/50 hover:bg-muted/30'}`}
            onClick={() => document.getElementById('portal-file-input').click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input id="portal-file-input" type="file" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setErrors(p => ({ ...p, file: null })); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-semibold">
                <Paperclip className="h-5 w-5" /> {file.name}
                <span className="text-xs text-muted-foreground font-normal">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm space-y-1">
                <Upload className="h-8 w-8 mx-auto opacity-30" />
                <p className="font-medium">Drag & drop or click to choose a file</p>
                <p className="text-xs">Any file type accepted</p>
              </div>
            )}
          </div>
          {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file}</p>}
        </div>
        {uploading && uploadProgress > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Uploading…</span><span>{uploadProgress}%</span></div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        <Button onClick={handleUpload} disabled={uploading} className="shadow-sm">
          {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload Document</>}
        </Button>
      </div>
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
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Uploaded</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map(doc => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium max-w-[180px] truncate">{doc.name}</td>
                    <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">{doc.doc_type}</span></td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{doc.application_number || ' - '}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        doc.review_status === 'Approved' ? 'bg-green-50 text-green-700' :
                        doc.review_status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
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

// ── Main Component ─────────────────────────────────────────────────────────
const uploadFileToServer = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('gmt_token');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) { const data = await res.json(); return data.url || ''; }
  } catch (e) { clearTimeout(timeoutId); console.warn('Upload failed:', e.message); }
  return '';
};

export default function SubrecipientHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [nofos, setNofos] = useState([]);
  const [apps, setApps] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [flags, setFlags] = useState([]);
  const [fundingRequests, setFundingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [tab, setTab] = useState('overview');
  const [nofoSearch, setNofoSearch] = useState('');
  const [nofoFilter, setNofoFilter] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [pendingAmendments, setPendingAmendments] = useState([]);
  const [genDocs, setGenDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [sendingReply, setSendingReply] = useState({});
  const [expandedThread, setExpandedThread] = useState(null);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    if (!u.organization_id) { setLoading(false); return; }

    const [openNofos, myApps, allSchedules, allFlags, allFRs, myTasks, myGenDocs, myMessages, allMilestones, myAmendments] = await Promise.all([
      base44.entities.Nofo.filter({ status: 'Published' }, '-open_date', 20).catch(() => []),
      base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 100).catch(() => []),
      base44.entities.ReportSchedule.list('-due_date', 100).catch(() => []),
      base44.entities.ComplianceFlag.list('-created_date', 50).catch(() => []),
      base44.entities.FundingRequest.filter({ organization_id: u.organization_id }, '-created_date', 200).catch(() => []),
      base44.entities.Task.filter({ assigned_to: u.email }, '-created_date', 50).catch(() => []),
      base44.entities.GeneratedDocument.filter({ organization_id: u.organization_id }, '-created_date', 20).catch(() => []),
      base44.entities.Message.filter({ organization_id: u.organization_id }, '-created_date', 100).catch(() => []),
      base44.entities.Milestone.filter({ organization_id: u.organization_id }, 'due_date', 50).catch(() => []),
      base44.entities.BudgetAmendment.filter({ organization_id: u.organization_id }, '-created_date', 50).catch(() => []),
    ]);

    const orgs = await base44.entities.Organization.filter({ id: u.organization_id });
    setOrg(orgs[0] || null);

    // Filter NOFOs to those scoped to the org's state (or with no state restriction)
    const orgState = orgs[0]?.state;
    const _now = new Date();
    const filteredNofos = (orgState
        ? openNofos.filter(n => !n.scope_states?.length || n.scope_states.includes(orgState))
        : openNofos).filter(n => !n.close_date || new Date(n.close_date) >= _now);
    setNofos(filteredNofos);
    setApps(myApps);
    const appIds = new Set(myApps.map(x => x.id));
    setSchedules(allSchedules.filter(s => appIds.has(s.application_id)));
    setFlags(allFlags.filter(f => appIds.has(f.application_id) && !f.is_resolved));
    setFundingRequests(allFRs);
    setTasks(myTasks.filter(t => !['Resolved', 'Cancelled'].includes(t.status)));
    const revisionAmends = (Array.isArray(myAmendments) ? myAmendments : []).filter(a => a.status === 'RevisionRequested');
    setPendingAmendments(revisionAmends);
    setGenDocs(myGenDocs.filter(d => ['Pending Signature', 'Sent'].includes(d.status)));
    const appIdSet = new Set(myApps.map(x => x.id));
    setMessages(myMessages.filter(m => m.application_id && appIdSet.has(m.application_id)));
    setMilestones(allMilestones.filter(m => appIdSet.has(m.application_id) && !['Completed', 'Waived'].includes(m.status)));
    setLoading(false);
  };

  useEffect(() => { loadData().catch(() => setLoading(false)); }, []);

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
      <p className="text-muted-foreground mb-4 max-w-md">Set up your organization profile to view open NOFOs and apply for funding.</p>
      <Link to="/my-organization"><Button>Set Up Organization</Button></Link>
    </div>
  );

  const activeGrants = apps.filter(a => a.status === 'Approved');
  const draftApps = apps.filter(a => a.status === 'Draft');
  const pendingReports = schedules.filter(s => s.status === 'Pending' || s.status === 'Overdue');
  const overdueReports = schedules.filter(s => s.status === 'Overdue');
  const pendingFRs = fundingRequests.filter(fr => ['Submitted', 'UnderReview', 'AdditionalInfoRequested'].includes(fr.status));
  const openTasks = tasks.filter(t => t.status !== 'Resolved' && t.status !== 'Cancelled');
  const actionItems = openTasks.length + genDocs.length + overdueReports.length + flags.length + pendingAmendments.length;
  const unreadMessages = messages.filter(m => m.sender_email !== user?.email); // Messages accessible via sidebar nav
  const upcomingMilestones = milestones.filter(m => {
    const d = m.due_date ? new Date(m.due_date) : null;
    return d && d >= new Date() && Math.ceil((d - new Date()) / 86400000) <= 60;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const overdueMilestones = milestones.filter(m => m.status === 'Overdue');

  // Group messages by application
  const messagesByApp = messages.reduce((acc, m) => {
    const key = m.application_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const handleSendReply = async (applicationId, applicationNumber) => {
    const text = replyText[applicationId]?.trim();
    if (!text) return;
    setSendingReply(p => ({ ...p, [applicationId]: true }));
    await base44.entities.Message.create({
      application_id: applicationId,
      application_number: applicationNumber,
      organization_id: user.organization_id,
      organization_name: org?.name || '',
      sender_email: user.email,
      sender_name: user.full_name,
      body: text,
      sent_at: new Date().toISOString(),
    });
    setReplyText(p => ({ ...p, [applicationId]: '' }));
    setSendingReply(p => ({ ...p, [applicationId]: false }));
    loadData();
  };
  const filteredNofos = nofos.filter(n => {
    const matchSearch = !nofoSearch || n.title?.toLowerCase().includes(nofoSearch.toLowerCase()) || n.program_code?.toLowerCase().includes(nofoSearch.toLowerCase()) || n.federal_agency?.toLowerCase().includes(nofoSearch.toLowerCase());
    const matchFilter = nofoFilter === 'all' || (nofoFilter === 'eligible' && (!n.eligible_org_types?.length || n.eligible_org_types.includes(org?.type))) || (nofoFilter === 'closing' && n.close_date && Math.ceil((new Date(n.close_date) - new Date()) / 86400000) <= 30);
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back, {user?.full_name?.split(' ')[0] || 'there'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/my-funding-requests?new=1">
            <Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1.5" /> Funding Request</Button>
          </Link>
        </div>
      </div>

      {/* Compliance Alert */}
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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Grants', value: activeGrants.length, icon: CheckCircle, color: 'bg-green-50 text-green-600', border: 'border-green-100' },
          { label: 'Total Awarded', value: formatCurrency(activeGrants.reduce((s, g) => s + (Number(g.awarded_amount) || 0), 0)), icon: DollarSign, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
          { label: 'Reports Due', value: pendingReports.length, icon: FileText, color: overdueReports.length > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600', border: overdueReports.length > 0 ? 'border-red-100' : 'border-amber-100' },
          { label: 'Pending Requests', value: pendingFRs.length, icon: Shield, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
        ].map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`bg-card border ${border} rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow`}>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allocations">
            Allocations {activeGrants.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({activeGrants.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1">
            Reports
            {pendingReports.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{pendingReports.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            Tasks &amp; Actions
            {actionItems > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{actionItems}</span>
            )}
          </TabsTrigger>
{/* Messages removed from dashboard - accessible via sidebar nav */}
          <TabsTrigger value="milestones" className="flex items-center gap-1">
            Milestones
            {overdueMilestones.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{overdueMilestones.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="apply">Apply for Funding</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Active Grants */}
            <div className="lg:col-span-3 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" /> Active Grants
              </h2>
              {activeGrants.length === 0 ? (
                <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No active grants yet</p>
                  <p className="text-xs mt-1">Browse open NOFOs to apply for funding.</p>
                  <Button className="mt-4" size="sm" onClick={() => setTab('apply')}>Browse Open NOFOs</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeGrants.slice(0, 4).map(grant => (
                    <AllocationCard key={grant.id} grant={grant} onViewDetails={setSelectedGrant} />
                  ))}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 space-y-5">
              {/* Organization Info Card */}
              {org && (
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> My Organization</h2>
                    <Link to="/my-organization">
                      <Button variant="ghost" size="sm" className="text-xs h-7">Edit <ChevronRight className="h-3 w-3 ml-1" /></Button>
                    </Link>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.type}</p>
                    {(org.city || org.state) && (
                      <p className="text-xs text-muted-foreground">{[org.city, org.state, org.zip].filter(Boolean).join(', ')}</p>
                    )}
                    {org.ein && <p className="text-xs text-muted-foreground">EIN: <span className="font-mono">{org.ein}</span></p>}
                    {org.sam_uei && <p className="text-xs text-muted-foreground">SAM UEI: <span className="font-mono">{org.sam_uei}</span></p>}
                  </div>
                </div>
              )}

              {/* My Applications */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-sm flex items-center gap-2"><CircleDot className="h-4 w-4 text-primary" /> My Applications</h2>
                  <Link to="/my-applications">
                    <Button variant="ghost" size="sm" className="text-xs h-7">View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
                  </Link>
                </div>
                {apps.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No applications yet.</div>
                ) : (
                  <div className="divide-y">
                    {apps.slice(0, 5).map(app => (
                      <div key={app.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{app.project_title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{app.application_number || 'Draft'} · {app.program_code}</p>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Reports */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Upcoming Reports</h2>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTab('reports')}>View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
                </div>
                {pendingReports.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No pending reports.</div>
                ) : (
                  <div className="divide-y">
                    {pendingReports.slice(0, 4).map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{s.report_type} Report</p>
                          <p className="text-xs text-muted-foreground">{s.application_number} · Due {formatDateShort(s.due_date)}</p>
                        </div>
                        <Button size="sm" variant={s.status === 'Overdue' ? 'destructive' : 'outline'} className="h-7 text-xs flex-shrink-0" onClick={() => setSelectedSchedule(s)}>Submit</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Open Tasks */}
              {openTasks.length > 0 && (
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-amber-500" /> Open Tasks
                      <span className="ml-1 text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{openTasks.length}</span>
                    </h2>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTab('tasks')}>View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
                  </div>
                  <div className="divide-y">
                    {openTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="px-4 py-3 flex items-start gap-2">
                        <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${task.priority === 'Critical' ? 'bg-red-500' : task.priority === 'High' ? 'bg-orange-500' : 'bg-amber-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.type} · Due {formatDateShort(task.due_date)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${task.status === 'InProgress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{task.status?.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Pending Signature */}
              {genDocs.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-amber-600" />
                    <h2 className="font-semibold text-sm text-amber-800">Documents Awaiting Your Signature</h2>
                    <span className="text-xs font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">{genDocs.length}</span>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {genDocs.slice(0, 3).map(doc => (
                      <div key={doc.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-900 truncate">{doc.template_name || doc.doc_type}</p>
                          <p className="text-xs text-amber-600">{doc.application_number} · Sent {formatDateShort(doc.sent_at || doc.created_date)}</p>
                        </div>
                        <Link to="/documents-inbox">
                          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 flex-shrink-0"><PenLine className="h-3 w-3 mr-1" />Sign</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Milestones */}
              {upcomingMilestones.length > 0 && (
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                      <Flag className="h-4 w-4 text-purple-500" /> Upcoming Milestones
                    </h2>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTab('milestones')}>View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
                  </div>
                  <div className="divide-y">
                    {upcomingMilestones.slice(0, 3).map(m => {
                      const daysLeft = Math.ceil((new Date(m.due_date) - new Date()) / 86400000);
                      return (
                        <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${daysLeft <= 14 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-purple-400'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{m.title}</p>
                            <p className="text-xs text-muted-foreground">{m.application_number} · {daysLeft}d left</p>
                          </div>
                          <StatusBadge status={m.status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-card border rounded-xl p-4 space-y-2">
                <h2 className="font-semibold text-sm flex items-center gap-2 mb-3"><Zap className="h-4 w-4 text-primary" /> Quick Actions</h2>
                {[
                  { label: 'Submit Funding Request', icon: DollarSign, to: '/my-funding-requests?new=1' },
                  { label: 'Upload Document', icon: Upload, action: () => setTab('documents') },
                  { label: 'View Messages', icon: MessageSquare, to: '/messages' },
                  { label: 'My Applications', icon: FileText, to: '/my-applications' },
                ].map(({ label, icon: Ic, to, action }) => (
                  to ? (
                    <Link key={label} to={to} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                      <span className="flex items-center gap-2.5 text-sm"><Ic className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />{label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </Link>
                  ) : (
                    <button key={label} onClick={action} className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group text-left">
                      <span className="flex items-center gap-2.5 text-sm"><Ic className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />{label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── ALLOCATIONS TAB ── */}
        <TabsContent value="allocations" className="mt-4 space-y-6">
          {activeGrants.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Active Grant Allocations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeGrants.map(grant => <AllocationCard key={grant.id} grant={grant} onViewDetails={setSelectedGrant} />)}
              </div>
            </div>
          )}
          {apps.filter(a => a.status !== 'Approved').length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 text-muted-foreground">Other Applications</h2>
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
                    {apps.filter(a => a.status !== 'Approved').map(app => (
                      <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                        <td className="p-3 font-medium">{app.project_title || ' - '}</td>
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
          {apps.length === 0 && (
            <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No grant allocations yet</p>
              <Button className="mt-4" size="sm" onClick={() => setTab('apply')}><Plus className="h-4 w-4 mr-1.5" /> Browse NOFOs</Button>
            </div>
          )}

          {/* Funding Request Tracker */}
          {fundingRequests.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Funding Request Tracker</h2>
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">Request #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundingRequests.slice(0, 10).map(fr => {
                      const payStatusColor = fr.payment_status === 'Paid' ? 'bg-green-50 text-green-700' : fr.payment_status === 'PaymentFailed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700';
                      return (
                        <tr key={fr.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-mono text-xs">{fr.request_number || ' - '}</td>
                          <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{fr.request_type}</span></td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(fr.amount_requested)}</td>
                          <td className="p-3"><StatusBadge status={fr.status} /></td>
                          <td className="p-3">
                            {fr.payment_status ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payStatusColor}`}>{fr.payment_status}</span>
                            ) : <span className="text-xs text-muted-foreground"> - </span>}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{formatDateShort(fr.created_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {fundingRequests.length > 10 && (
                  <div className="p-3 border-t text-center">
                    <Link to="/my-funding-requests"><Button variant="ghost" size="sm">View All {fundingRequests.length} Requests <ChevronRight className="h-3.5 w-3.5 ml-1" /></Button></Link>
                  </div>
                )}
              </div>
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
                      <p className="text-sm font-medium text-red-800">{s.report_type} Report - {s.application_number}</p>
                      <p className="text-xs text-red-600">Was due {formatDateShort(s.due_date)}</p>
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => setSelectedSchedule(s)}>Submit Now</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="p-4 border-b"><p className="font-semibold">All Report Schedules</p></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
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
                    <tr key={s.id} className={`border-b last:border-0 ${s.status === 'Overdue' ? 'bg-red-50/50' : 'hover:bg-muted/20'}`}>
                      <td className="p-3 font-mono text-xs">{s.application_number}</td>
                      <td className="p-3 font-medium">{s.report_type}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(s.period_start)} - {formatDateShort(s.period_end)}</td>
                      <td className={`p-3 text-xs font-medium ${s.status === 'Overdue' ? 'text-red-600' : ''}`}>{formatDateShort(s.due_date)}</td>
                      <td className="p-3"><StatusBadge status={s.status} /></td>
                      <td className="p-3">
                        {(s.status === 'Pending' || s.status === 'Overdue') && (
                          <Button size="sm" variant={s.status === 'Overdue' ? 'destructive' : 'default'} onClick={() => setSelectedSchedule(s)}>Submit</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No report schedules found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── APPLY TAB ── */}
        <TabsContent value="apply" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="font-semibold text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Open NOFOs</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {[['all', 'All'], ['eligible', 'Eligible'], ['closing', 'Closing Soon']].map(([val, label]) => (
                  <button key={val} onClick={() => setNofoFilter(val)}
                    className={`px-3 py-1.5 font-medium transition-colors ${nofoFilter === val ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-muted/40'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-52"
                  placeholder="Search by title, program, agency…"
                  value={nofoSearch}
                  onChange={e => setNofoSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          {filteredNofos.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No open NOFOs right now</p>
              <p className="text-xs mt-1">Check back soon for new funding opportunities.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNofos.map(nofo => (
                <NofoCard key={nofo.id} nofo={nofo} orgType={org?.type} onApply={n => navigate(`/new-application?nofo_id=${n.id}`)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TASKS & ACTIONS TAB ── */}
        <TabsContent value="tasks" className="mt-4 space-y-5">
          {/* Documents Pending Signature */}
          {genDocs.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-amber-50 flex items-center gap-2">
                <PenLine className="h-4 w-4 text-amber-600" />
                <h2 className="font-semibold text-sm text-amber-800">Documents Awaiting Signature</h2>
                <span className="text-xs font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">{genDocs.length}</span>
              </div>
              <div className="divide-y">
                {genDocs.map(doc => (
                  <div key={doc.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.template_name || doc.doc_type}</p>
                        <p className="text-xs text-muted-foreground">{doc.application_number} · Sent by NEMA · {formatDateShort(doc.sent_at || doc.created_date)}</p>
                      </div>
                    </div>
                    <Link to="/documents-inbox">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 flex-shrink-0"><PenLine className="h-3.5 w-3.5 mr-1.5" />Review &amp; Sign</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open Tasks */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Assigned Tasks &amp; RFIs</h2>
            </div>
            {openTasks.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No open tasks</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {openTasks.map(task => {
                  const prioColor = task.priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' : task.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' : task.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                  return (
                    <div key={task.id} className="px-5 py-4 flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${task.type === 'RFI' ? 'bg-blue-50' : task.type === 'Review' ? 'bg-purple-50' : 'bg-green-50'}`}>
                        {task.type === 'RFI' ? <MessageSquare className="h-5 w-5 text-blue-600" /> : task.type === 'Review' ? <Eye className="h-5 w-5 text-purple-600" /> : <CheckSquare className="h-5 w-5 text-green-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                              {task.application_id ? (
                                <Link to={`/my-applications?id=${task.application_id}`} className="text-primary font-mono underline hover:no-underline text-xs">{task.application_number}</Link>
                              ) : (
                                <span className="text-muted-foreground font-mono">{task.application_number}</span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${prioColor}`}>{task.priority}</span>
                              {task.due_date && (
                                <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                  <Clock className="h-3 w-3" /> Due {formatDateShort(task.due_date)}
                                  {isOverdue && ' · OVERDUE'}
                                </span>
                              )}
                            </div>
                            {/* RFI Response */}
                            {(task.type === 'RFI' || task.type === 'rfi' || !task.type) && (task.status === 'Open' || task.status === 'Pending') && (
                              <div className="mt-3 space-y-2">
                                <textarea className="w-full text-sm border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" rows={3} placeholder="Type your response to this RFI..." id={`rfi-${task.id}`} />
                                <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium" onClick={async()=>{const el=document.getElementById('rfi-'+task.id);const r=el?.value?.trim();if(!r){alert('Please enter a response.');return;}try{await base44.entities.Task.update(task.id,{status:'PendingAdminReview',notes:r,resolved_by:user?.email,resolved_at:new Date().toISOString()});await loadData();}catch(e){alert('Failed to submit.');}}}>Submit Response</button>
                              </div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${task.status === 'InProgress' ? 'bg-blue-50 text-blue-700' : task.status === 'PendingAdminReview' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>{task.status?.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Amendment Revision Requests */}
          {pendingAmendments.length > 0 && (
            <div className="bg-card border border-orange-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-orange-50 flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-orange-600" />
                <h2 className="font-semibold text-sm text-orange-800">Amendment Revision Requested</h2>
                <span className="text-xs font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">{pendingAmendments.length}</span>
              </div>
              <div className="divide-y">
                {pendingAmendments.map(am => (
                  <div key={am.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{am.amendment_number}</p>
                        <p className="text-xs text-muted-foreground">{am.application_number} - Net change: {am.net_change >= 0 ? '+' : ''}{formatCurrency(Number(am.net_change) || 0)}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium flex-shrink-0">Revision Requested</span>
                    </div>
                    {am.reviewer_notes && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-800">
                        <span className="font-semibold">Reviewer Notes: </span>{am.reviewer_notes}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Go to My Applications → Amendments tab to review and resubmit.</p>
                    <Link to="/my-applications">
                      <button className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md font-medium">View &amp; Resubmit</button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Compliance Flags */}
          {flags.length > 0 && (
            <div className="bg-card border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-red-50 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h2 className="font-semibold text-sm text-red-800">Open Compliance Flags</h2>
                <span className="text-xs font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">{flags.length}</span>
              </div>
              <div className="divide-y">
                {flags.map(flag => (
                  <FlagActionRow key={flag.id} flag={flag} user={user} onResolved={() => loadData()} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── MESSAGES TAB ── */}
        <TabsContent value="milestones" className="mt-4 space-y-4">
          {overdueMilestones.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-red-200">
                <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Overdue Milestones</p>
              </div>
              <div className="divide-y divide-red-100">
                {overdueMilestones.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-red-800">{m.title}</p>
                      <p className="text-xs text-red-600">{m.application_number} · Was due {formatDateShort(m.due_date)}</p>
                      {m.notes && <p className="text-xs text-red-500 mt-0.5">{m.notes}</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{m.milestone_type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {milestones.length === 0 ? (
            <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
              <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No milestones yet</p>
              <p className="text-xs mt-1">Track progress milestones for your grants.</p>
              <Link to="/milestones"><Button className="mt-4" size="sm">Go to Milestones</Button></Link>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="p-4 border-b"><p className="font-semibold">All Active Milestones</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-3 font-medium text-muted-foreground">Milestone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(m => {
                      const daysLeft = m.due_date ? Math.ceil((new Date(m.due_date) - new Date()) / 86400000) : null;
                      const isNear = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
                      return (
                        <tr key={m.id} className={`border-b last:border-0 ${m.status === 'Overdue' ? 'bg-red-50/40' : isNear ? 'bg-amber-50/40' : 'hover:bg-muted/20'}`}>
                          <td className="p-3">
                            <p className="font-medium">{m.title}</p>
                            {m.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.notes}</p>}
                          </td>
                          <td className="p-3 text-xs font-mono text-muted-foreground">{m.application_number || ' - '}</td>
                          <td className="p-3 text-xs"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">{m.milestone_type?.replace(/([A-Z])/g, ' $1').trim() || 'Custom'}</span></td>
                          <td className={`p-3 text-xs font-medium ${m.status === 'Overdue' ? 'text-red-600' : isNear ? 'text-amber-700' : ''}`}>
                            {formatDateShort(m.due_date)}
                            {daysLeft !== null && daysLeft >= 0 && <span className="ml-1 text-muted-foreground">({daysLeft}d)</span>}
                          </td>
                          <td className="p-3"><StatusBadge status={m.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── DOCUMENTS TAB ── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentUploadSection apps={apps.filter(a => a.status !== 'Draft')} user={user} onUploaded={loadData} />
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics" className="mt-4">
          <PortalAnalyticsTab apps={apps} fundingRequests={fundingRequests} />
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