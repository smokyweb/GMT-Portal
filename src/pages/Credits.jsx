import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, X, BadgeDollarSign, XCircle } from 'lucide-react';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { toast } from 'sonner';

const STATUS_STYLES = {
  Active:          { bg: 'bg-green-100',  text: 'text-green-700'  },
  PartiallyUsed:   { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  FullyRedeemed:   { bg: 'bg-slate-100',  text: 'text-slate-500'  },
  Voided:          { bg: 'bg-red-100',    text: 'text-red-700'    },
};

function CreditBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Active;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {status?.replace(/([A-Z])/g, ' $1').trim()}
    </span>
  );
}

export default function Credits() {
  const [credits, setCredits] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [voidDialog, setVoidDialog] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    organization_id: '',
    amount: '',
    description: '',
    application_number: '',
    program_code: '',
    expiration_date: '',
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [u, c, o] = await Promise.all([
      base44.auth.me(),
      base44.entities.Credit.list('-created_date', 100),
      base44.entities.Organization.filter({ is_active: true }),
    ]);
    setUser(u);

    // Filter credits and organizations by user role
    let filteredOrgs = o;
    let filteredCredits = c;

    if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
      if (u.role === 'admin' && u.scope_state) {
        // State admin: see organizations and credits in their state
        filteredOrgs = o.filter(org => org.state === u.scope_state);
        const stateOrgIds = new Set(filteredOrgs.map(org => org.id));
        filteredCredits = c.filter(credit => stateOrgIds.has(credit.organization_id));
      } else if (u.role === 'user' && u.organization_id) {
        // Subrecipient: see only their organization's credits
        filteredOrgs = o.filter(org => org.id === u.organization_id);
        filteredCredits = c.filter(credit => credit.organization_id === u.organization_id);
      }
    }

    setCredits(filteredCredits);
    setOrgs(filteredOrgs);
    setLoading(false);
  };

  const resetForm = () => setForm({ organization_id: '', amount: '', description: '', application_number: '', program_code: '', expiration_date: '' });

  const handleIssue = async () => {
    setSubmitting(true);
    const allCredits = await base44.entities.Credit.list('-created_date', 1000);
    const creditNum = `CRD-${new Date().getFullYear()}-${String(allCredits.length + 1).padStart(4, '0')}`;
    const org = orgs.find(o => o.id === form.organization_id);
    const amt = Number(form.amount);

    const credit = await base44.entities.Credit.create({
      organization_id: form.organization_id,
      organization_name: org?.name || '',
      amount: amt,
      amount_remaining: amt,
      description: form.description,
      issued_by: user.email,
      credit_number: creditNum,
      status: 'Active',
      application_number: form.application_number || undefined,
      program_code: form.program_code || undefined,
      expiration_date: form.expiration_date || undefined,
    });

    // Look up org users to notify them
    const users = await base44.entities.User.list();
    const orgUsers = users.filter(u => u.organization_id === form.organization_id);
    for (const ou of orgUsers) {
      await createNotification(base44, ou.email,
        `Credit Issued: ${formatCurrency(amt)}`,
        `A credit of ${formatCurrency(amt)} (${creditNum}) has been issued to your organization${form.description ? ': ' + form.description : '.'}.`,
        'credit_issued', 'Credit', credit.id, '/my-funding-requests');
    }

    await logAudit(base44, user, 'CreditIssued', 'Credit', credit.id, `Issued credit ${creditNum} of ${formatCurrency(amt)} to ${org?.name}`);
    toast.success(`Credit ${creditNum} issued for ${formatCurrency(amt)}`);
    setSubmitting(false);
    setOpen(false);
    resetForm();
    load();
  };

  const handleVoid = async () => {
    await base44.entities.Credit.update(voidDialog.id, { status: 'Voided', void_reason: voidReason });
    await logAudit(base44, user, 'CreditVoided', 'Credit', voidDialog.id, `Voided credit ${voidDialog.credit_number}: ${voidReason}`);
    toast.success('Credit voided.');
    setVoidDialog(null);
    setVoidReason('');
    load();
  };

  const filtered = credits.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.credit_number?.toLowerCase().includes(q) || c.organization_name?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalIssued = credits.filter(c => c.status !== 'Voided').reduce((s, c) => s + (c.amount || 0), 0);
  const totalRemaining = credits.filter(c => c.status !== 'Voided').reduce((s, c) => s + (c.amount_remaining || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subrecipient Credits</h1>
          <p className="text-muted-foreground text-sm mt-1">Issue and manage monetary credits for subrecipient organizations</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Issue Credit
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Credits Issued</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalIssued)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Remaining Balance</p>
          <p className="text-2xl font-bold mt-1 text-green-700">{formatCurrency(totalRemaining)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active Credits</p>
          <p className="text-2xl font-bold mt-1">{credits.filter(c => c.status === 'Active' || c.status === 'PartiallyUsed').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by credit # or organization…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="PartiallyUsed">Partially Used</option>
          <option value="FullyRedeemed">Fully Redeemed</option>
          <option value="Voided">Voided</option>
        </select>
        {(search || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus(''); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Credit #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Remaining</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Issued By</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Expires</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-mono text-xs font-semibold">{c.credit_number}</td>
                  <td className="p-3 font-medium">{c.organization_name}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(c.amount)}</td>
                  <td className="p-3 text-right font-semibold text-green-700">{formatCurrency(c.amount_remaining)}</td>
                  <td className="p-3 text-muted-foreground max-w-[200px] truncate">{c.description || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.issued_by}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(c.created_date)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.expiration_date ? formatDateShort(c.expiration_date) : '—'}</td>
                  <td className="p-3"><CreditBadge status={c.status} /></td>
                  <td className="p-3">
                    {(c.status === 'Active' || c.status === 'PartiallyUsed') && (
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => { setVoidDialog(c); setVoidReason(''); }}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Void
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No credits found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Credit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5" /> Issue Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organization <span className="text-red-500">*</span></Label>
              <Select value={form.organization_id} onValueChange={v => setForm(f => ({ ...f, organization_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select organization…" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Amount ($) <span className="text-red-500">*</span></Label>
              <Input className="mt-1" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Description / Reason</Label>
              <Textarea className="mt-1" rows={2} placeholder="e.g. Overpayment adjustment, performance incentive…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Associated Application # <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input className="mt-1" placeholder="e.g. APP-2025-0001" value={form.application_number} onChange={e => setForm(f => ({ ...f, application_number: e.target.value }))} />
              </div>
              <div>
                <Label>Program Code <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input className="mt-1" placeholder="e.g. SHSP" value={form.program_code} onChange={e => setForm(f => ({ ...f, program_code: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Expiration Date <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input className="mt-1" type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleIssue} disabled={submitting || !form.organization_id || !form.amount || Number(form.amount) <= 0}>
              {submitting ? 'Issuing…' : 'Issue Credit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={!!voidDialog} onOpenChange={() => setVoidDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Void Credit {voidDialog?.credit_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This will cancel the remaining balance of <strong>{formatCurrency(voidDialog?.amount_remaining)}</strong>. This action cannot be undone.</p>
            <div>
              <Label>Reason for Voiding <span className="text-red-500">*</span></Label>
              <Textarea className="mt-1" rows={2} placeholder="Explain why this credit is being voided…" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!voidReason.trim()} onClick={handleVoid}>Confirm Void</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}