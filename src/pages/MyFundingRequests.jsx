import { base44 } from '@/api/base44Client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, Paperclip, X, Loader2, Eye, Search } from 'lucide-react';
import DocumentUploadPanel from '../components/DocumentUploadPanel';
import CsvImportDialog from '../components/CsvImportDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '../components/StatusBadge';
import LifecycleProgress from '../components/LifecycleProgress';
import CreditApplicationPanel from '../components/CreditApplicationPanel';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { toast } from 'sonner';
import { AEL_CATEGORY_LABELS, getAELItemsForCategory } from '../lib/aelData';

const CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];

const CORE_CAPABILITIES = [
  'Planning', 'Public Information and Warning', 'Operational Coordination',
  'Forensics and Attribution', 'Intelligence and Information Sharing', 'Interdiction and Disruption',
  'Screening, Search, and Detection', 'Access Control and Identity Verification', 'Cybersecurity',
  'Physical Protective Measures', 'Risk Management for Protection Programs and Activities',
  'Supply Chain Integrity and Security', 'Community Resilience', 'Long-Term Vulnerability Reduction',
  'Risk and Disaster Resilience Assessment', 'Threats and Hazards Identification',
  'Critical Transportation', 'Environmental Response/Health and Safety', 'Fatality Management Services',
  'Fire Management and Suppression', 'Infrastructure Systems', 'Logistics and Supply Chain Management',
  'Mass Care Services', 'Mass Search and Rescue Operations',
  'On-Scene Security, Protection, and Law Enforcement', 'Operational Communications',
  'Public Health, Healthcare, and Emergency Medical Services', 'Situational Assessment',
  'Economic Recovery', 'Health and Social Services', 'Housing', 'Natural and Cultural Resources',
];

const DISCIPLINES = [
  'Agriculture and Food', 'Cyber Security', 'Emergency Management',
  'Emergency Medical Services - Fire Based', 'Emergency Medical Services - Non-Fire Based',
  'Emergency Management Agency', 'Fire Service', 'Governmental Administrative',
  'Hazardous Materials', 'Health Care', 'Law Enforcement', 'Not for Profit / Non-Profit',
  'Public Health', 'Public Safety Communications', 'Public Works',
  'Regional Transit System', 'Search and Rescue',
];



const PAYMENT_STATUS_CONFIG = {
  PendingDisbursement: { label: 'Pending Disbursement', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  SubmittedToFinance:  { label: 'Submitted to Finance', bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  Paid:                { label: 'Paid',                  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  PaymentFailed:       { label: 'Payment Failed',        bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
};

function PaymentBadge({ status }) {
  if (!status) return <span className="text-xs text-muted-foreground">""</span>;
  const cfg = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.PendingDisbursement;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const MODIFICATION_TYPES = [
  'Budget Modification', 'Scope of Work Change', 'Period of Performance Extension',
  'Key Personnel Change', 'Other',
];

const EMPTY_LINE_ITEM = {
  budget_category: 'Equipment', description: '', amount: 0,
  quantity: '', unit_cost: '',
  ael_category: '', ael_number: '',
  expenditure_name: '', item_manufacturer: '', item_model: '',
  item_detail_description: '', sole_source_justification: '',
  thira_spr_capability_action: '', thira_spr_primary_capability: '',
  resource_type: '', discipline: '',
};

export default function MyFundingRequests() {
  const [requests, setRequests] = useState([]);
  const [apps, setApps] = useState([]);
  const [user, setUser] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    application_id: '', request_type: 'Reimbursement',
    period_start: '', period_end: '', match_documented: 0,
    modification_type: '', modification_justification: '',
    scope_of_work_current: '', scope_of_work_proposed: '',
    budget_modification_notes: '',
  });
  const [lineItems, setLineItems] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachDocType, setAttachDocType] = useState('Other');
  const fileInputRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    if (u.organization_id) {
      const [r, a] = await Promise.all([
        base44.entities.FundingRequest.filter({ organization_id: u.organization_id }, '-created_date', 50),
        base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 100),
      ]);
      setRequests(r);
      setApps(a);
    }
    setLoading(false);
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new')) setOpen(true);
  };

  const selectedApp = apps.find(a => a.id === form.application_id);
  const lineTotal = lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const resetForm = () => {
    setLineItems([]);
    setAttachments([]);
    setForm({
      application_id: '', request_type: 'Reimbursement',
      period_start: '', period_end: '', match_documented: 0,
      modification_type: '', modification_justification: '',
      scope_of_work_current: '', scope_of_work_proposed: '',
      budget_modification_notes: '',
    });
  };

  const updateLineItem = (idx, field, value) =>
    setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newItems = files.map(f => ({ file: f, uploading: true, url: null, name: f.name, docType: attachDocType }));
    setAttachments(prev => [...prev, ...newItems]);
    for (const item of newItems) {
      let file_url = '';
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        const token = localStorage.getItem('gmt_token');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) { const data = await res.json(); file_url = data.url || ''; }
      } catch (uploadErr) {
        console.warn('Upload failed:', uploadErr.message);
        alert('File upload failed: ' + (uploadErr.name === 'AbortError' ? 'Request timed out. Try a smaller file.' : uploadErr.message));
      }
      setAttachments(prev => prev.map(a => a.name === item.name && a.uploading ? { ...a, uploading: false, url: file_url } : a));
    }
    e.target.value = '';
  };

  const removeAttachment = (name) => setAttachments(prev => prev.filter(a => a.name !== name));

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.application_id) { alert('Please select a grant.'); return; }
    if (form.request_type === 'Modification' && !form.modification_type) {
      alert('Please select a Modification Type before submitting.');
      return;
    }
    setSubmitting(true);
    try {
    const allReqs = await base44.entities.FundingRequest.list('-created_date', 1000).catch(() => []);
    const reqNum = `REQ-${new Date().getFullYear()}-${String(allReqs.length + 1).padStart(5, '0')}`;
    const isModification = form.request_type === 'Modification';

    const fr = await base44.entities.FundingRequest.create({
      application_id: form.application_id,
      application_number: selectedApp?.application_number,
      organization_id: user.organization_id,
      organization_name: selectedApp?.organization_name,
      submitted_by: user.email,
      request_number: reqNum,
      request_type: form.request_type,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      amount_requested: isModification ? 0 : lineTotal,
      match_documented: isModification ? 0 : Number(form.match_documented),
      status: 'Submitted',
      program_code: selectedApp?.program_code,
      expenditure_rate: Number(selectedApp?.expenditure_rate) || 0,
      remaining_balance: Number(selectedApp?.remaining_balance) || 0,
      ...(isModification && {
        modification_type: form.modification_type || null,
        modification_justification: form.modification_justification,
        scope_of_work_current: form.scope_of_work_current,
        scope_of_work_proposed: form.scope_of_work_proposed,
        budget_modification_notes: form.budget_modification_notes,
      }),
    });

    if (!isModification) {
      for (const li of lineItems) {
        // Only send fields that exist in the funding_request_line_items DB table
        await base44.entities.FundingRequestLineItem.create({
          funding_request_id: fr.id,
          budget_category: li.budget_category,
          description: li.description || li.expenditure_name || '',
          amount: Number(li.amount) || 0,
          amount_requested: Number(li.amount) || 0,
          is_allowable: true,
          vendor: li.item_manufacturer || undefined,
          reviewer_notes: li.item_detail_description || undefined,
        });
      }
    }

    for (const att of attachments.filter(a => a.url)) {
      await base44.entities.Document.create({
        name: att.name,
        doc_type: att.docType || 'Other',
        file_url: att.url,
        uploaded_by: user.email,
        organization_id: user.organization_id,
        application_id: form.application_id,
        application_number: selectedApp?.application_number,
        organization_name: selectedApp?.organization_name,
        funding_request_id: fr.id,
        funding_request_number: reqNum,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
        description: `Attached to funding request ${reqNum}`,
      });
    }

    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'New Funding Request',
        `${selectedApp?.organization_name} submitted funding request ${reqNum}.`,
        'fr_submitted', 'FundingRequest', fr.id, '/funding-requests');
    }

    await logAudit(base44, user, 'Submitted', 'FundingRequest', fr.id, `Submitted funding request ${reqNum}`);
    // Cross-log to application audit trail
    if (form.application_id) {
      logAudit(base44, user, 'Submitted', 'Application', form.application_id,
        `Funding Request ${reqNum} submitted for reimbursement`).catch(() => {});
    }
    setSubmitting(false);
    setOpen(false);
    resetForm();
    toast.success(`Request ${reqNum} submitted successfully.`);
    loadData();
    } catch (err) {
      console.error('FR submit error:', err);
      alert('Failed to submit funding request: ' + (err?.message || err?.detail || 'Please try again.'));
      setSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const q = search.toLowerCase();
    const matchSearch = !q || req.request_number?.toLowerCase().includes(q) || req.application_number?.toLowerCase().includes(q);
    const matchType = !filterType || req.request_type === filterType;
    const matchStatus = !filterStatus || req.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funding Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">{requests.length} requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)} disabled={apps.length === 0}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button onClick={() => setOpen(true)} disabled={apps.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by request # or grant..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Select value={filterType || 'all'} onValueChange={v => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Reimbursement">Reimbursement</SelectItem>
            <SelectItem value="Advance">Advance</SelectItem>
            <SelectItem value="Modification">Modification</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus || 'all'} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="UnderReview">Under Review</SelectItem>
            <SelectItem value="AdditionalInfoRequested">Info Requested</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Denied">Denied</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterType || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Request #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Grant</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{req.request_number}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{req.request_type}</span></td>
                  <td className="p-3 text-xs">{req.application_number}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(req.period_start)} - {formatDateShort(req.period_end)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(req.amount_requested)}</td>
                  <td className="p-3"><StatusBadge status={req.status} /></td>
                  <td className="p-3">{req.request_type !== 'Modification' ? <PaymentBadge status={req.payment_status} /> : <span className="text-xs text-muted-foreground">N/A</span>}</td>
                  <td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setViewRequest(req)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button></td>
                </tr>
              ))}
              {filteredRequests.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{requests.length === 0 ? 'No funding requests' : 'No requests match your filters'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} apps={apps} user={user} onSuccess={loadData} />

      {/* View Request Dialog */}
      <Dialog open={!!viewRequest} onOpenChange={() => setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Request {viewRequest?.request_number}</DialogTitle></DialogHeader>
          {viewRequest && (
            <Tabs defaultValue="summary">
              <TabsList className="mb-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="credits">Credits</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Request #</p><p className="font-mono font-medium">{viewRequest.request_number}</p></div>
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{viewRequest.request_type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Grant</p><p className="font-medium">{viewRequest.application_number}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={viewRequest.status} /></div>
                  <div><p className="text-xs text-muted-foreground">Period</p><p className="font-medium">{formatDateShort(viewRequest.period_start)} - {formatDateShort(viewRequest.period_end)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Amount Requested</p><p className="font-semibold">{formatCurrency(viewRequest.amount_requested)}</p></div>
                  {viewRequest.amount_approved != null && <div><p className="text-xs text-muted-foreground">Amount Approved</p><p className="font-semibold text-green-700">{formatCurrency(viewRequest.amount_approved)}</p></div>}
                  {viewRequest.request_type !== 'Modification' && (
                    <div><p className="text-xs text-muted-foreground">Payment Status</p><div className="mt-1"><PaymentBadge status={viewRequest.payment_status} /></div></div>
                  )}
                  {viewRequest.payment_reference && <div><p className="text-xs text-muted-foreground">Payment Reference</p><p className="font-mono font-medium">{viewRequest.payment_reference}</p></div>}
                  {viewRequest.payment_date && <div><p className="text-xs text-muted-foreground">Payment Date</p><p className="font-medium">{viewRequest.payment_date ? viewRequest.payment_date.substring(0, 10) : '-'}</p></div>}
                </div>
                <LifecycleProgress status={viewRequest.status} type="funding" />
              </TabsContent>
              <TabsContent value="credits">
                <CreditApplicationPanel
                  organizationId={user?.organization_id}
                  fundingRequest={viewRequest}
                  user={user}
                  onApplied={loadData}
                />
              </TabsContent>
              <TabsContent value="attachments">
                <DocumentUploadPanel
                  applicationId={viewRequest.application_id}
                  applicationNumber={viewRequest.application_number}
                  organizationName={viewRequest.organization_name}
                  organizationId={user?.organization_id}
                  user={user}
                  fundingRequestId={viewRequest.id}
                  fundingRequestNumber={viewRequest.request_number}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* New Request Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.request_type === 'Modification' ? 'Submit Grant Modification Request' :
               form.request_type === 'Advance' ? 'Submit Advance Request' : 'Submit Reimbursement Request'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Type + Grant */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Request Type <span className="text-red-500">*</span></Label>
                <Select value={form.request_type} onValueChange={v => setForm(f => ({ ...f, request_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                    <SelectItem value="Advance">Advance</SelectItem>
                    <SelectItem value="Modification">Modification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Grant <span className="text-red-500">*</span></Label>
                <Select value={form.application_id} onValueChange={v => setForm(f => ({ ...f, application_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose active grant" /></SelectTrigger>
                  <SelectContent>
                    {apps.filter(a => a.status === 'Approved').map(a => <SelectItem key={a.id} value={a.id}>{a.application_number} - {a.project_title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* â"€â"€ MODIFICATION FORM â"€â"€ */}
            {form.request_type === 'Modification' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  A modification request changes the terms of your existing grant award. All modifications are subject to state approval before taking effect.
                </div>
                <div>
                  <Label>Modification Type <span className="text-red-500">*</span></Label>
                  <Select value={form.modification_type} onValueChange={v => setForm(f => ({ ...f, modification_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select modification type" /></SelectTrigger>
                    <SelectContent>{MODIFICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Justification / Reason for Modification</Label>
                  <Textarea rows={3} placeholder="Describe why this modification is needed..."
                    value={form.modification_justification} onChange={e => setForm(f => ({ ...f, modification_justification: e.target.value }))} />
                </div>
                {form.modification_type === 'Scope of Work Change' && (
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-semibold">Scope of Work Change</p>
                    <div>
                      <Label>Current Scope of Work</Label>
                      <Textarea rows={4} placeholder="Describe the current approved scope of work..."
                        value={form.scope_of_work_current} onChange={e => setForm(f => ({ ...f, scope_of_work_current: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Proposed Scope of Work</Label>
                      <Textarea rows={4} placeholder="Describe the proposed changes..."
                        value={form.scope_of_work_proposed} onChange={e => setForm(f => ({ ...f, scope_of_work_proposed: e.target.value }))} />
                    </div>
                  </div>
                )}
                {form.modification_type === 'Budget Modification' && (
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-semibold">Budget Modification Details</p>
                    <div>
                      <Label>Budget Change Description</Label>
                      <Textarea rows={4} placeholder="Describe the budget categories being changed and the amounts involved..."
                        value={form.budget_modification_notes} onChange={e => setForm(f => ({ ...f, budget_modification_notes: e.target.value }))} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Revised Budget Line Items</Label>
                        <Button variant="outline" size="sm" onClick={() => setLineItems(prev => [...prev, { budget_category: 'Personnel', description: '', amount: 0 }])}>+ Add</Button>
                      </div>
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                          <th className="p-2"></th>
                        </tr></thead>
                        <tbody>
                          {lineItems.map((li, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2">
                                <Select value={li.budget_category} onValueChange={v => updateLineItem(idx, 'budget_category', v)}>
                                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>
                              <td className="p-2"><Input value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} /></td>
                              <td className="p-2"><Input type="number" className="text-right w-28" value={li.amount} onChange={e => updateLineItem(idx, 'amount', e.target.value)} /></td>
                              <td className="p-2"><Button variant="ghost" size="icon" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                            </tr>
                          ))}
                        </tbody>
                        {lineItems.length > 0 && <tfoot><tr className="font-bold"><td colSpan={2} className="p-2">Total</td><td className="p-2 text-right">{formatCurrency(lineTotal)}</td><td></td></tr></tfoot>}
                      </table>
                    </div>
                  </div>
                )}
                {form.modification_type === 'Period of Performance Extension' && (
                  <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/30">
                    <p className="col-span-2 text-sm font-semibold">New Performance Period</p>
                    <div><Label>New Start Date</Label><Input type="date" value={form.period_start ? form.period_start.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                    <div><Label>New End Date</Label><Input type="date" value={form.period_end ? form.period_end.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                  </div>
                )}
              </div>
            )}

            {/* â"€â"€ REIMBURSEMENT / ADVANCE FORM â"€â"€ */}
            {form.request_type !== 'Modification' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start <span className="text-red-500">*</span></Label><Input type="date" value={form.period_start ? form.period_start.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                  <div><Label>Period End <span className="text-red-500">*</span></Label><Input type="date" value={form.period_end ? form.period_end.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                </div>

                {form.request_type === 'Advance' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    Advance requests are for funds needed before expenses are incurred. Documentation of planned expenditures is required.
                  </div>
                )}

                {selectedApp && (
                  <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-muted-foreground text-xs">Awarded</p><p className="font-bold">{formatCurrency(selectedApp.awarded_amount)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Expended to Date</p><p className="font-bold">{formatCurrency(selectedApp.total_expended)}</p></div>
                    <div><p className="text-muted-foreground text-xs">This Request</p><p className="font-bold">{formatCurrency(lineTotal)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Projected Remaining</p><p className="font-bold">{formatCurrency((selectedApp.remaining_balance || selectedApp.awarded_amount) - lineTotal)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Expenditure Rate</p><ExpenditureBar rate={selectedApp.expenditure_rate || 0} /></div>
                    <div><p className="text-muted-foreground text-xs">Match Documented ($)</p><Input type="number" value={form.match_documented} onChange={e => setForm(f => ({ ...f, match_documented: e.target.value }))} className="mt-1 h-8" /></div>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label>Expenditure Line Items <span className="text-red-500">*</span></Label>
                      {form.request_type !== 'Modification' && lineItems.length === 0 && (
                        <p className="text-xs text-red-500 mt-0.5">At least one line item is required to submit</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }])}>+ Add Item</Button>
                  </div>
                  <div className="space-y-4">
                    {lineItems.map((li, idx) => (
                      <div key={idx} className="rounded-lg border p-4 bg-muted/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                          <Button variant="ghost" size="icon" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>

                        {/* Basic info */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Budget Category <span className="text-red-500">*</span></Label>
                            <Select value={li.budget_category} onValueChange={v => updateLineItem(idx, 'budget_category', v)}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Expenditure Name <span className="text-red-500">*</span></Label>
                            <Input className="mt-1" placeholder="e.g. Physical Access Control System" value={li.expenditure_name} onChange={e => updateLineItem(idx, 'expenditure_name', e.target.value)} />
                          </div>

                          {/* AEL / Equipment-specific fields */}
                          {li.budget_category === 'Equipment' && <>
                            <div>
                              <Label className="text-xs">AEL Category</Label>
                              <Select value={li.ael_category} onValueChange={v => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, ael_category: v, ael_number: '' } : l))}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select AEL category" /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {AEL_CATEGORY_LABELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">AEL Number</Label>
                              <Select value={li.ael_number} onValueChange={v => updateLineItem(idx, 'ael_number', v)} disabled={!li.ael_category}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder={li.ael_category ? 'Select AEL item' : 'Select category first'} /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {getAELItemsForCategory(li.ael_category).map(item => (
                                    <SelectItem key={item.code} value={item.code}>{item.code} "" {item.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Manufacturer</Label>
                              <Input className="mt-1" placeholder="Manufacturer name" value={li.item_manufacturer} onChange={e => updateLineItem(idx, 'item_manufacturer', e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Model</Label>
                              <Input className="mt-1" placeholder="Model number or name" value={li.item_model} onChange={e => updateLineItem(idx, 'item_model', e.target.value)} />
                            </div>
                          </>}
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input className="mt-1" type="number" placeholder="0" value={li.quantity}
                              onChange={e => {
                                const qty = e.target.value;
                                const total = li.unit_cost ? (Number(qty) * Number(li.unit_cost)).toFixed(2) : li.amount;
                                setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, quantity: qty, amount: total } : l));
                              }} />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost ($)</Label>
                            <Input className="mt-1" type="number" placeholder="0.00" value={li.unit_cost}
                              onChange={e => {
                                const uc = e.target.value;
                                const total = (Number(uc) * (Number(li.quantity) || 1)).toFixed(2);
                                setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, unit_cost: uc, amount: total } : l));
                              }} />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Item Description</Label>
                            <Textarea className="mt-1" rows={2} placeholder="Detailed description of the item..." value={li.item_detail_description} onChange={e => updateLineItem(idx, 'item_detail_description', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Sole Source Justification (if applicable)</Label>
                            <Input className="mt-1" placeholder="Leave blank if not a sole-source purchase" value={li.sole_source_justification} onChange={e => updateLineItem(idx, 'sole_source_justification', e.target.value)} />
                          </div>
                          <div className="col-span-2 flex items-center justify-between border-t pt-3">
                            <div className="flex-1 mr-4">
                              <Label className="text-xs">General Description / Purpose</Label>
                              <Input className="mt-1" placeholder="Brief description / purpose" value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Label className="text-xs font-semibold">Total ($) <span className="text-red-500">*</span></Label>
                              <Input type="number" className="text-right w-28" value={li.amount} onChange={e => updateLineItem(idx, 'amount', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {/* THIRA/SPR per line item */}
                        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                          <p className="text-xs font-semibold text-blue-800">THIRA/SPR Classification</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Capability Action</Label>
                              <Select value={li.thira_spr_capability_action} onValueChange={v => updateLineItem(idx, 'thira_spr_capability_action', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Sustain/Maintain">Sustain/Maintain</SelectItem>
                                  <SelectItem value="Build New Capability">Build New Capability</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Resource Type</Label>
                              <Select value={li.resource_type} onValueChange={v => updateLineItem(idx, 'resource_type', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Deployable">Deployable</SelectItem>
                                  <SelectItem value="Shareable">Shareable</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Primary Core Capability</Label>
                              <Select value={li.thira_spr_primary_capability} onValueChange={v => updateLineItem(idx, 'thira_spr_primary_capability', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select core capability" /></SelectTrigger>
                                <SelectContent className="max-h-60">{CORE_CAPABILITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Discipline</Label>
                              <Select value={li.discipline} onValueChange={v => updateLineItem(idx, 'discipline', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select discipline" /></SelectTrigger>
                                <SelectContent className="max-h-60">{DISCIPLINES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {lineItems.length > 0 && (
                    <div className="flex justify-end mt-2 font-bold text-sm border-t pt-2">
                      Total: {formatCurrency(lineTotal)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Attachments */}
            <div>
              <Label>Supporting Documents</Label>
              <p className="text-xs text-muted-foreground mb-2">Attach receipts, invoices, or any supporting documentation.</p>
              <div className="flex items-center gap-2 mb-2">
                <Select value={attachDocType} onValueChange={setAttachDocType}>
                  <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Invoice','PerformanceEvidence','Contract','BudgetJustification','MatchDocumentation','ProgressNarrative','FinalReport','Other'].map(t => (
                      <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Document type for next upload</span>
              </div>
              <div className="space-y-2">
                {attachments.map(a => (
                  <div key={a.name} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 text-sm">
                    {a.uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" /> : <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <span className="flex-1 truncate text-xs">{a.name}</span>
                    {a.docType && <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{a.docType.replace(/([A-Z])/g, ' $1').trim()}</span>}
                    {!a.uploading && a.url && <span className="text-xs text-green-600 font-medium">&#10003;</span>}
                    <button onClick={() => removeAttachment(a.name)} className="text-muted-foreground hover:text-destructive transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition w-full">
                  <Paperclip className="h-4 w-4" /> Attach files
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                attachments.some(a => a.uploading) ||
                !form.application_id ||
                (form.request_type !== 'Modification' && lineItems.length === 0)
              }
            >
              {submitting ? 'Submitting...' : `Submit ${form.request_type === 'Modification' ? 'Modification' : 'Request'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}