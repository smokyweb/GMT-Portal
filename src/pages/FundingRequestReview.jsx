import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, FileText, Search, X, Plus, Trash2, AlertCircle, CreditCard, Send, CheckCircle, XCircle, ShieldCheck, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '../components/StatusBadge';
import ContextualThread from '../components/ContextualThread';
import MultiStepApprovalPanel from '../components/MultiStepApprovalPanel';
import FundingRequestDocsViewer from '../components/FundingRequestDocsViewer';
import RequiredTemplatesPanel from '@/components/RequiredTemplatesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExpenditureBar from '../components/ExpenditureBar';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import ReviewHistory from '../components/ReviewHistory';

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

const COMMON_REQUIRED_DOCS = [
  'Invoices / Receipts',
  'Bank Statements',
  'Payroll Records',
  'Match Documentation',
  'Procurement Records',
  'Contract / Agreement',
  'Proof of Delivery',
  'Time & Attendance Records',
];


export default function FundingRequestReview() {
  const [requests, setRequests] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [viewReq, setViewReq] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoComments, setInfoComments] = useState('');
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [customDoc, setCustomDoc] = useState('');
  const [showDenyPanel, setShowDenyPanel] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [paymentAction, setPaymentAction] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const dateFilter = useDateRangeFilter();

  useEffect(() => {
    const loadData = async () => {
      const [allRequests, u] = await Promise.all([
        base44.entities.FundingRequest.list('-created_date', 200),
        base44.auth.me(),
      ]);
      let visible = allRequests;
      if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
        if (u.role === 'admin' && u.scope_state) {
          // State admin: see requests from orgs in their state
          const orgs = await base44.entities.Organization.filter({ state: u.scope_state });
          const orgIds = new Set(orgs.map(o => o.id));
          visible = allRequests.filter(r => orgIds.has(r.organization_id));
        } else if (u.role === 'user' && u.organization_id) {
          // Subrecipient: see only their organization's requests
          visible = allRequests.filter(r => r.organization_id === u.organization_id);
        }
      }
      setRequests(visible);
      setUser(u);
      setLoading(false);
    };
    loadData();
  }, []);

  const openReview = async (req) => {
    const items = await base44.entities.FundingRequestLineItem.filter({ funding_request_id: req.id });
    setLineItems(items);
    setSelected(req);
    setApprovedAmount(req.amount_requested);
    setNotes('');
    setShowInfoPanel(false);
    setInfoComments('');
    setRequiredDocs([]);
    setCustomDoc('');
    setShowDenyPanel(false);
    setDenyReason('');
    setShowPaymentPanel(false);
    setPaymentAction('');
    setPaymentReference('');
    setPaymentDate('');
    setVoucherNumber('');
  };

  const PAYMENT_STATUS_CONFIG = {
    PendingDisbursement:  { label: 'Pending Disbursement',      bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400' },
    SubmittedToFinance:   { label: 'Submitted to Finance',      bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
    PendingPMApproval:    { label: 'Awaiting PM Approval',      bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
    PendingFOApproval:    { label: 'Awaiting FO Approval',      bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
    Paid:                 { label: 'Paid',                      bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
    PaymentFailed:        { label: 'Payment Failed',            bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  };

  const PaymentBadge = ({ status }) => {
    if (!status) return null;
    const cfg = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.PendingDisbursement;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const handlePaymentUpdate = async () => {
    try {
    const updates = { payment_status: paymentAction };
    if (paymentReference) updates.payment_reference = paymentReference;
    if (paymentDate) updates.payment_date = paymentDate;
    if (voucherNumber) updates.voucher_number = voucherNumber;
    await base44.entities.FundingRequest.update(selected.id, updates);
    const label = PAYMENT_STATUS_CONFIG[paymentAction]?.label || paymentAction;
    await logAudit(base44, user, paymentAction, 'FundingRequest', selected.id,
      `Updated payment status to "${label}" for ${selected.request_number}${paymentReference ? ` (Ref: ${paymentReference})` : ''}`);
    await createNotification(base44, selected.submitted_by,
      `Payment Status Updated: ${label}`,
      `The payment status for your funding request ${selected.request_number} has been updated to "${label}".`,
      'fr_payment', 'FundingRequest', selected.id, '/my-funding-requests');
    // Update local state immediately for instant UI refresh
    setRequests(prev => prev.map(req => req.id === selected.id ? { ...req, ...updates } : req));
    setSelected(null);
    // Reload in background
    base44.entities.FundingRequest.list('-created_date', 200).then(r => {
      let visible = r;
      if (user?.scope_state) {
        base44.entities.Organization.filter({ state: user.scope_state }).then(orgs => {
          const orgIds = new Set(orgs.map(o => o.id));
          setRequests(r.filter(req => orgIds.has(req.organization_id)));
        }).catch(() => setRequests(r));
      } else {
        setRequests(r);
      }
    }).catch(() => {});
    } catch (err) {
      console.error('Payment update error:', err);
      alert('Failed to update payment status: ' + (err?.detail || err?.message || 'Please try again.'));
    }
  };

  const handleRequestInfo = async () => {
    const docList = requiredDocs.length > 0
      ? `\n\nRequired Documents:\n${requiredDocs.map(d => `• ${d}`).join('\n')}`
      : '';
    const fullNotes = `${infoComments}${docList}`;
    await base44.entities.FundingRequest.update(selected.id, {
      status: 'AdditionalInfoRequested',
      reviewer_notes: fullNotes,
    });
    await createNotification(base44, selected.submitted_by,
      'Additional Information Required',
      `Your funding request ${selected.request_number} requires additional information. Please review the reviewer comments.`,
      'fr_info_requested', 'FundingRequest', selected.id, '/my-funding-requests');
    await logAudit(base44, user, 'AdditionalInfoRequested', 'FundingRequest', selected.id,
      `Requested additional info for ${selected.request_number}`);
    setSelected(null);
    await refreshRequests();
  };

  const handleAction = async (action) => {
    const updates = { status: action, reviewer_notes: notes };
    if (action === 'Approved') {
      updates.amount_approved = Number(approvedAmount);
      // Update application expended/remaining
      const app = await base44.entities.Application.filter({ id: selected.application_id });
      if (app.length > 0) {
        const a = app[0];
        const newExpended = (a.total_expended || 0) + Number(approvedAmount);
        const newRemaining = (a.awarded_amount || 0) - newExpended;
        const newRate = a.awarded_amount ? (newExpended / a.awarded_amount) * 100 : 0;
        await base44.entities.Application.update(a.id, {
          total_expended: newExpended,
          remaining_balance: newRemaining,
          expenditure_rate: Math.round(newRate * 100) / 100,
        });
      }
    }
    await base44.entities.FundingRequest.update(selected.id, updates);
    await createNotification(base44, selected.submitted_by,
      `Funding Request ${action}`,
      `Your funding request ${selected.request_number} has been ${action.toLowerCase()}.`,
      'fr_status', 'FundingRequest', selected.id, '/my-funding-requests');
    await logAudit(base44, user, action, 'FundingRequest', selected.id,
      `${action} funding request ${selected.request_number}`);
    setSelected(null);
    await refreshRequests();
  };

  const refreshRequests = async () => {
    const r = await base44.entities.FundingRequest.list('-created_date', 200);
    let visible = r;
    if (user?.scope_state) {
      const orgs = await base44.entities.Organization.filter({ state: user.scope_state });
      const orgIds = new Set(orgs.map(o => o.id));
      visible = r.filter(req => orgIds.has(req.organization_id));
    }
    setRequests(visible);
  };

  const orgs = [...new Set(requests.map(r => r.organization_name).filter(Boolean))].sort();

  const { start: rangeStart, end: rangeEnd } = dateFilter.getEffectiveDateRange();

  const filteredRequests = requests.filter(req => {
    const q = search.toLowerCase();
    const matchSearch = !q || req.request_number?.toLowerCase().includes(q) || req.application_number?.toLowerCase().includes(q) || req.organization_name?.toLowerCase().includes(q);
    const matchType = !filterType || req.request_type === filterType;
    const matchStatus = !filterStatus || req.status === filterStatus;
    const matchOrg = !filterOrg || req.organization_name === filterOrg;
    const matchDateStart = !rangeStart || (req.period_start && new Date(req.period_start) >= new Date(rangeStart));
    const matchDateEnd = !rangeEnd || (req.period_end && new Date(req.period_end) <= new Date(rangeEnd));
    return matchSearch && matchType && matchStatus && matchOrg && matchDateStart && matchDateEnd;
  });

  const hasFilters = search || filterType || filterStatus || filterOrg || dateFilter.dateMode !== 'none';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Funding Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and process funding requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by request #, app #, or org..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All Types</option>
          <option value="Reimbursement">Reimbursement</option>
          <option value="Advance">Advance</option>
          <option value="Modification">Modification</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="UnderReview">Under Review</option>
          <option value="AdditionalInfoRequested">Info Requested</option>
          <option value="Approved">Approved</option>
          <option value="Denied">Denied</option>
        </select>
        {orgs.length > 0 && (
          <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring max-w-[200px]">
            <option value="">All Organizations</option>
            {orgs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
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
            <input type="date" placeholder="Start Date" value={dateFilter.dateStart} onChange={e => dateFilter.setDateStart(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" title="Period start" />
            <input type="date" placeholder="End Date" value={dateFilter.dateEnd} onChange={e => dateFilter.setDateEnd(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" title="Period end" />
          </>
        )}
        {(hasFilters) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterOrg(''); dateFilter.reset(); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
        {hasFilters && <span className="text-xs text-muted-foreground">{filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''}</span>}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Request #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground min-w-[120px]">Expenditure</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-mono text-xs">{req.request_number || '—'}</td>
                  <td className="p-3 font-medium">{req.organization_name || '—'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{req.request_type}</span>
                  </td>
                  <td className="p-3 font-mono text-xs">{req.application_number || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatDateShort(req.period_start)} – {formatDateShort(req.period_end)}
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(req.amount_requested)}</td>
                  <td className="p-3"><ExpenditureBar rate={req.expenditure_rate || 0} /></td>
                  <td className="p-3"><StatusBadge status={req.status} /></td>
                  <td className="p-3"><PaymentBadge status={req.payment_status} /></td>
                  <td className="p-3 flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewReq(req)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openReview(req)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Review
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{requests.length === 0 ? 'No funding requests' : 'No requests match your filters'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Dialog (read-only) */}
      <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Funding Request {viewReq?.request_number}</DialogTitle>
              <StatusBadge status={viewReq?.status} />
            </div>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground text-xs">Organization</Label><p className="font-medium">{viewReq.organization_name}</p></div>
                <div><Label className="text-muted-foreground text-xs">Type</Label><p className="font-medium">{viewReq.request_type}</p></div>
                <div><Label className="text-muted-foreground text-xs">Application #</Label><p className="font-mono font-medium">{viewReq.application_number || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Program</Label><p className="font-medium">{viewReq.program_code || '—'}</p></div>
                <div><Label className="text-muted-foreground text-xs">Amount Requested</Label><p className="font-bold text-lg">{formatCurrency(viewReq.amount_requested)}</p></div>
                {viewReq.amount_approved != null && <div><Label className="text-muted-foreground text-xs">Amount Approved</Label><p className="font-bold text-lg text-green-700">{formatCurrency(viewReq.amount_approved)}</p></div>}
                <div><Label className="text-muted-foreground text-xs">Period</Label><p className="font-medium">{formatDateShort(viewReq.period_start)} – {formatDateShort(viewReq.period_end)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Match Documented</Label><p className="font-medium">{formatCurrency(viewReq.match_documented)}</p></div>
              </div>
              {viewReq.modification_type && (
                <div><Label className="text-muted-foreground text-xs">Modification Type</Label><p className="font-medium">{viewReq.modification_type}</p></div>
              )}
              {viewReq.modification_justification && (
                <div><Label className="text-muted-foreground text-xs">Justification</Label><p className="whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewReq.modification_justification}</p></div>
              )}
              {viewReq.payment_reference && (
                <div><Label className="text-muted-foreground text-xs">Payment Reference</Label><p className="font-medium font-mono">{viewReq.payment_reference}</p></div>
              )}
              {viewReq.voucher_number && (
                <div><Label className="text-muted-foreground text-xs">Voucher Number</Label><p className="font-medium font-mono">{viewReq.voucher_number}</p></div>
              )}
              {viewReq.reviewer_notes && (
                <div><Label className="text-muted-foreground text-xs">Reviewer Notes</Label><p className="whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{viewReq.reviewer_notes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Funding Request {selected?.request_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <Tabs defaultValue="review">
              <TabsList className="mb-4">
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Documents
                </TabsTrigger>
                <TabsTrigger value="required-templates">Required Templates</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
              <TabsContent value="review">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground text-xs">Organization</Label><p className="font-medium">{selected.organization_name}</p></div>
                <div><Label className="text-muted-foreground text-xs">Type</Label><p className="font-medium">{selected.request_type}</p></div>
                <div><Label className="text-muted-foreground text-xs">Amount Requested</Label><p className="font-bold text-lg">{formatCurrency(selected.amount_requested)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Period</Label><p className="font-medium">{formatDateShort(selected.period_start)} – {formatDateShort(selected.period_end)}</p></div>
                {selected.payment_status && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Payment Status</Label>
                    <div className="mt-1"><PaymentBadge status={selected.payment_status} /></div>
                  </div>
                )}
                {selected.payment_reference && (
                  <div><Label className="text-muted-foreground text-xs">Payment Reference</Label><p className="font-medium font-mono">{selected.payment_reference}</p></div>
                )}
                {selected.voucher_number && (
                  <div><Label className="text-muted-foreground text-xs">Voucher Number</Label><p className="font-medium font-mono">{selected.voucher_number}</p></div>
                )}
              </div>

              {lineItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expenditure Line Items</p>
                  {lineItems.map(li => (
                    <div key={li.id} className="rounded-lg border p-3 bg-muted/10 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-muted font-medium">{li.budget_category}</span>
                          {li.expenditure_name && <span className="font-semibold">{li.expenditure_name}</span>}
                        </div>
                        <span className="font-bold text-sm">{formatCurrency(li.amount)}</span>
                      </div>
                      {(li.ael_number || li.ael_category) && (
                        <div className="text-muted-foreground">
                          {li.ael_category && <span className="mr-3"><span className="font-medium">AEL Category:</span> {li.ael_category}</span>}
                          {li.ael_number && <span><span className="font-medium">AEL #:</span> {li.ael_number}</span>}
                        </div>
                      )}
                      {(li.item_manufacturer || li.item_model) && (
                        <div className="text-muted-foreground">
                          {li.item_manufacturer && <span className="mr-3"><span className="font-medium">Mfg:</span> {li.item_manufacturer}</span>}
                          {li.item_model && <span><span className="font-medium">Model:</span> {li.item_model}</span>}
                        </div>
                      )}
                      {(li.quantity || li.unit_cost) && (
                        <div className="text-muted-foreground">
                          {li.quantity && <span className="mr-3"><span className="font-medium">Qty:</span> {li.quantity}</span>}
                          {li.unit_cost && <span><span className="font-medium">Unit Cost:</span> {formatCurrency(li.unit_cost)}</span>}
                        </div>
                      )}
                      {li.item_detail_description && <p className="text-muted-foreground"><span className="font-medium">Description:</span> {li.item_detail_description}</p>}
                      {li.sole_source_justification && <p className="text-amber-700 bg-amber-50 rounded px-2 py-1"><span className="font-medium">Sole Source:</span> {li.sole_source_justification}</p>}
                      {li.description && <p className="text-muted-foreground border-t pt-1">{li.description}</p>}
                      {(li.thira_spr_primary_capability || li.thira_spr_capability_action || li.resource_type || li.discipline) && (
                        <div className="rounded border border-blue-100 bg-blue-50/50 px-2 py-1.5 space-y-0.5">
                          <p className="font-semibold text-blue-800">THIRA/SPR</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                            {li.thira_spr_capability_action && <span><span className="font-medium">Action:</span> {li.thira_spr_capability_action}</span>}
                            {li.resource_type && <span><span className="font-medium">Resource:</span> {li.resource_type}</span>}
                            {li.thira_spr_primary_capability && <span className="w-full"><span className="font-medium">Capability:</span> {li.thira_spr_primary_capability}</span>}
                            {li.discipline && <span className="w-full"><span className="font-medium">Discipline:</span> {li.discipline}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end font-bold text-sm border-t pt-2">
                    Total: {formatCurrency(lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0))}
                  </div>
                </div>
              )}

              <div>
                <Label>Approved Amount ($)</Label>
                <Input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
              </div>
              <div>
                <Label>Reviewer Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes for Approve / Deny..." />
              </div>

              {/* Additional Info Request Panel */}
              {showInfoPanel && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Additional Information Request
                  </div>

                  <div>
                    <Label className="text-sm">Comments to Subrecipient <span className="text-red-500">*</span></Label>
                    <Textarea
                      className="mt-1 bg-white"
                      rows={3}
                      placeholder="Explain what information or clarification is needed..."
                      value={infoComments}
                      onChange={e => setInfoComments(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm mb-2 block">Required Documents</Label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {COMMON_REQUIRED_DOCS.map(doc => (
                        <div key={doc} className="flex items-center gap-2">
                          <Checkbox
                            id={doc}
                            checked={requiredDocs.includes(doc)}
                            onCheckedChange={checked => {
                              setRequiredDocs(prev => checked ? [...prev, doc] : prev.filter(d => d !== doc));
                            }}
                          />
                          <label htmlFor={doc} className="text-xs cursor-pointer">{doc}</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        className="bg-white text-sm h-8"
                        placeholder="Add custom document requirement..."
                        value={customDoc}
                        onChange={e => setCustomDoc(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customDoc.trim()) {
                            setRequiredDocs(prev => [...prev, customDoc.trim()]);
                            setCustomDoc('');
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => { if (customDoc.trim()) { setRequiredDocs(prev => [...prev, customDoc.trim()]); setCustomDoc(''); } }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {requiredDocs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {requiredDocs.map(doc => (
                          <div key={doc} className="flex items-center justify-between bg-white rounded px-2 py-1 text-xs border">
                            <span>• {doc}</span>
                            <button onClick={() => setRequiredDocs(prev => prev.filter(d => d !== doc))}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={() => setShowInfoPanel(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      disabled={!infoComments.trim()}
                      onClick={handleRequestInfo}
                    >
                      Send Request
                    </Button>
                  </div>
                </div>
              )}

              {/* Deny Panel */}
              {showDenyPanel && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Denial Reason <span className="text-red-500">*</span>
                  </div>
                  <Textarea
                    className="bg-white"
                    rows={3}
                    placeholder="Explain why this request is being denied..."
                    value={denyReason}
                    onChange={e => setDenyReason(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowDenyPanel(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!denyReason.trim()}
                      onClick={async () => {
                        await base44.entities.FundingRequest.update(selected.id, {
                          status: 'Denied',
                          reviewer_notes: denyReason,
                        });
                        await createNotification(base44, selected.submitted_by,
                          'Funding Request Denied',
                          `Your funding request ${selected.request_number} has been denied. Reason: ${denyReason}`,
                          'fr_status', 'FundingRequest', selected.id, '/my-funding-requests');
                        await logAudit(base44, user, 'Denied', 'FundingRequest', selected.id,
                          `Denied funding request ${selected.request_number}: ${denyReason}`);
                        setSelected(null);
                        await refreshRequests();
                      }}
                    >
                      Confirm Denial
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment Status Panel */}
              {showPaymentPanel && selected.request_type !== 'Modification' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                    <CreditCard className="h-4 w-4" />
                    Update Payment Status
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">New Payment Status <span className="text-red-500">*</span></Label>
                      <select
                        className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={paymentAction}
                        onChange={e => setPaymentAction(e.target.value)}
                      >
                        <option value="">Select status...</option>
                        <option value="SubmittedToFinance">Submitted to Finance</option>
                        <option value="Paid">Paid</option>
                        <option value="PaymentFailed">Payment Failed</option>
                        <option value="PendingDisbursement">Pending Disbursement</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Payment Date</Label>
                      <Input type="date" className="mt-1 bg-white" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Reference / Check Number</Label>
                    <Input className="mt-1 bg-white" placeholder="e.g. CHK-1234 or ACH ref..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Voucher Number</Label>
                    <Input className="mt-1 bg-white" placeholder="e.g. VCH-2025-001" value={voucherNumber} onChange={e => setVoucherNumber(e.target.value)} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowPaymentPanel(false)}>Cancel</Button>
                    <Button size="sm" disabled={!paymentAction} onClick={handlePaymentUpdate} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Save Payment Status
                    </Button>
                  </div>
                </div>
              )}

              {/* Multi-step approval status panel */}
              {selected.requires_multi_step_approval && selected.status === 'Approved' && selected.request_type !== 'Modification' && (
                <MultiStepApprovalPanel selected={selected} user={user} onComplete={async () => {
                  setSelected(null);
                  await refreshRequests();
                }} />
              )}

              {!showInfoPanel && !showDenyPanel && !showPaymentPanel && (
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  {selected.status === 'Approved' && selected.request_type !== 'Modification' && !selected.requires_multi_step_approval && (
                    <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setShowPaymentPanel(true)}>
                      <CreditCard className="h-3.5 w-3.5 mr-1" /> Update Payment
                    </Button>
                  )}
                  {selected.status === 'Approved' && selected.request_type !== 'Modification' && !selected.requires_multi_step_approval && (
                    <Button
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      onClick={async () => {
                        await base44.entities.FundingRequest.update(selected.id, {
                          requires_multi_step_approval: true,
                          payment_status: 'PendingPMApproval',
                          pm_approval_status: 'Pending',
                        });
                        await logAudit(base44, user, 'Updated', 'FundingRequest', selected.id, `Enabled multi-step payment approval for ${selected.request_number}`);
                        setSelected(null);
                        await refreshRequests();
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Enable Multi-Step Approval
                    </Button>
                  )}
                  <Button variant="destructive" onClick={() => setShowDenyPanel(true)}>Deny</Button>
                  <Button variant="secondary" onClick={() => setShowInfoPanel(true)}>Request Info</Button>
                  <Button onClick={() => handleAction('Approved')}>Approve</Button>
                </div>
              )}
            </div>
              </TabsContent>
              <TabsContent value="documents">
                <ReviewHistory
                  entityType="FundingRequest"
                  entityId={selected?.id}
                  user={user}
                  className="mb-4"
                />
                <FundingRequestDocsViewer fundingRequest={selected} user={user} />
              </TabsContent>
              <TabsContent value="required-templates">
                <RequiredTemplatesPanel
                  entityType="FundingRequest"
                  entityId={selected.id}
                  requiredTemplateIds={selected.required_template_ids || []}
                  onUpdate={async (ids) => {
                    await base44.entities.FundingRequest.update(selected.id, { required_template_ids: ids });
                    setSelected(s => ({ ...s, required_template_ids: ids }));
                    await refreshRequests();
                  }}
                  isAdmin={true}
                />
              </TabsContent>
              <TabsContent value="messages">
                <ContextualThread
                  applicationId={selected.application_id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  programCode={selected.program_code}
                  user={user}
                  contextLabel={`Messages — ${selected.request_number}`}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}