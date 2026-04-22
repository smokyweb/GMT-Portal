import { base44 } from '@/api/base44Client';
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, Paperclip, X, Loader2 } from 'lucide-react';
import CsvImportDialog from '../components/CsvImportDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '../components/StatusBadge';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { toast } from 'sonner';

const CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];

const MODIFICATION_TYPES = [
  'Budget Modification',
  'Scope of Work Change',
  'Period of Performance Extension',
  'Key Personnel Change',
  'Other',
];

export default function MyFundingRequests() {
  const [requests, setRequests] = useState([]);
  const [apps, setApps] = useState([]);
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    application_id: '',
    request_type: 'Reimbursement',
    period_start: '',
    period_end: '',
    match_documented: 0,
    modification_type: '',
    modification_justification: '',
    scope_of_work_current: '',
    scope_of_work_proposed: '',
    budget_modification_notes: '',
  });
  const [lineItems, setLineItems] = useState([]);
  const [attachments, setAttachments] = useState([]); // [{ file, uploading, url, name }]
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    if (u.organization_id) {
      const [r, a] = await Promise.all([
        base44.entities.FundingRequest.filter({ organization_id: u.organization_id }, '-created_date', 50),
        base44.entities.Application.filter({ organization_id: u.organization_id, status: 'Approved' }),
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
    setForm({ application_id: '', request_type: 'Reimbursement', period_start: '', period_end: '', match_documented: 0, modification_type: '', modification_justification: '', scope_of_work_current: '', scope_of_work_proposed: '', budget_modification_notes: '' });
  };

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

  const removeAttachment = (name) => setAttachments(prev => prev.filter(a => a.name !== name));

  const handleSubmit = async () => {
    setSubmitting(true);
    const allReqs = await base44.entities.FundingRequest.list('-created_date', 1000);
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
      period_start: form.period_start,
      period_end: form.period_end,
      amount_requested: isModification ? 0 : lineTotal,
      match_documented: isModification ? 0 : Number(form.match_documented),
      status: 'Submitted',
      program_code: selectedApp?.program_code,
      expenditure_rate: selectedApp?.expenditure_rate || 0,
      remaining_balance: selectedApp?.remaining_balance || 0,
      ...(isModification && {
        modification_type: form.modification_type,
        modification_justification: form.modification_justification,
        scope_of_work_current: form.scope_of_work_current,
        scope_of_work_proposed: form.scope_of_work_proposed,
        budget_modification_notes: form.budget_modification_notes,
      }),
    });

    if (!isModification) {
      for (const li of lineItems) {
        await base44.entities.FundingRequestLineItem.create({
          funding_request_id: fr.id,
          budget_category: li.budget_category,
          description: li.description,
          amount: Number(li.amount),
          is_allowable: true,
        });
      }
    }

    // Save uploaded documents linked to this request
    for (const att of attachments.filter(a => a.url)) {
      await base44.entities.Document.create({
        name: att.name,
        doc_type: 'Invoice',
        file_url: att.url,
        uploaded_by: user.email,
        organization_id: user.organization_id,
        application_id: form.application_id,
        application_number: selectedApp?.application_number,
        organization_name: selectedApp?.organization_name,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
        description: `Attached to funding request ${reqNum}`,
      });
    }

    // Notify state reviewers
    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'New Funding Request',
        `${selectedApp?.organization_name} submitted funding request ${reqNum}.`,
        'fr_submitted', 'FundingRequest', fr.id, '/funding-requests');
    }

    await logAudit(base44, user, 'Submitted', 'FundingRequest', fr.id, `Submitted funding request ${reqNum}`);
    setSubmitting(false);
    setOpen(false);
    resetForm();
    toast.success(`Request ${reqNum} submitted successfully.`);
    loadData();
  };

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
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{req.request_number}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{req.request_type}</span></td>
                  <td className="p-3 text-xs">{req.application_number}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(req.period_start)} – {formatDateShort(req.period_end)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(req.amount_requested)}</td>
                  <td className="p-3"><StatusBadge status={req.status} /></td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No funding requests</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <CsvImportDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        apps={apps}
        user={user}
        onSuccess={loadData}
      />

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
            {/* Type selector + grant selector */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Request Type</Label>
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
                <Label>Select Grant</Label>
                <Select value={form.application_id} onValueChange={v => setForm(f => ({ ...f, application_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choose active grant" /></SelectTrigger>
                  <SelectContent>
                    {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.application_number} — {a.project_title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── MODIFICATION FORM ── */}
            {form.request_type === 'Modification' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  A modification request changes the terms of your existing grant award. All modifications are subject to state approval before taking effect.
                </div>

                <div>
                  <Label>Modification Type</Label>
                  <Select value={form.modification_type} onValueChange={v => setForm(f => ({ ...f, modification_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select modification type" /></SelectTrigger>
                    <SelectContent>
                      {MODIFICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Justification / Reason for Modification</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe why this modification is needed..."
                    value={form.modification_justification}
                    onChange={e => setForm(f => ({ ...f, modification_justification: e.target.value }))}
                  />
                </div>

                {/* Scope of Work Change fields */}
                {form.modification_type === 'Scope of Work Change' && (
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-semibold text-foreground">Scope of Work Change</p>
                    <div>
                      <Label>Current Scope of Work</Label>
                      <Textarea
                        rows={4}
                        placeholder="Describe the current approved scope of work..."
                        value={form.scope_of_work_current}
                        onChange={e => setForm(f => ({ ...f, scope_of_work_current: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Proposed Scope of Work</Label>
                      <Textarea
                        rows={4}
                        placeholder="Describe the proposed changes to the scope of work..."
                        value={form.scope_of_work_proposed}
                        onChange={e => setForm(f => ({ ...f, scope_of_work_proposed: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Budget Modification fields */}
                {form.modification_type === 'Budget Modification' && (
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-semibold text-foreground">Budget Modification Details</p>
                    <div>
                      <Label>Budget Change Description</Label>
                      <Textarea
                        rows={4}
                        placeholder="Describe the budget categories being changed and the amounts involved..."
                        value={form.budget_modification_notes}
                        onChange={e => setForm(f => ({ ...f, budget_modification_notes: e.target.value }))}
                      />
                    </div>

                    {/* Line items still available for budget mods */}
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
                                <Select value={li.budget_category} onValueChange={v => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, budget_category: v } : l))}>
                                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>
                              <td className="p-2"><Input value={li.description} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} /></td>
                              <td className="p-2"><Input type="number" className="text-right w-28" value={li.amount} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))} /></td>
                              <td className="p-2"><Button variant="ghost" size="icon" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                            </tr>
                          ))}
                        </tbody>
                        {lineItems.length > 0 && <tfoot><tr className="font-bold"><td colSpan={2} className="p-2">Total</td><td className="p-2 text-right">{formatCurrency(lineTotal)}</td><td></td></tr></tfoot>}
                      </table>
                    </div>
                  </div>
                )}

                {/* Period extension dates */}
                {form.modification_type === 'Period of Performance Extension' && (
                  <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/30">
                    <p className="col-span-2 text-sm font-semibold text-foreground">New Performance Period</p>
                    <div><Label>New Start Date</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                    <div><Label>New End Date</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                  </div>
                )}
              </div>
            )}

            {/* ── REIMBURSEMENT / ADVANCE FORM ── */}
            {form.request_type !== 'Modification' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                  <div><Label>Period End</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                </div>

                {form.request_type === 'Advance' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    Advance requests are for funds needed before expenses are incurred. Documentation of planned expenditures is required.
                  </div>
                )}

                {/* Summary panel */}
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
                    <Label>Line Items</Label>
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
                            <Select value={li.budget_category} onValueChange={v => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, budget_category: v } : l))}>
                              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="p-2"><Input value={li.description} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} /></td>
                          <td className="p-2"><Input type="number" className="text-right w-28" value={li.amount} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))} /></td>
                          <td className="p-2"><Button variant="ghost" size="icon" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="font-bold"><td colSpan={2} className="p-2">Total</td><td className="p-2 text-right">{formatCurrency(lineTotal)}</td><td></td></tr></tfoot>
                  </table>
                </div>
              </>
            )}
            {/* Attachments */}
            <div>
              <Label>Supporting Documents</Label>
              <p className="text-xs text-muted-foreground mb-2">Attach receipts, invoices, or any supporting documentation.</p>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                attachments.some(a => a.uploading) ||
                !form.application_id ||
                (form.request_type !== 'Modification' && lineItems.length === 0) ||
                (form.request_type === 'Modification' && !form.modification_type)
              }
            >
              {submitting ? 'Submitting…' : `Submit ${form.request_type === 'Modification' ? 'Modification' : 'Request'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}