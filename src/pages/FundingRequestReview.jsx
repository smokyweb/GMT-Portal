import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import StatusBadge from '../components/StatusBadge';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';

export default function FundingRequestReview() {
  const [requests, setRequests] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  useEffect(() => {
    Promise.all([
      base44.entities.FundingRequest.list('-created_date', 50),
      base44.auth.me(),
    ]).then(([r, u]) => {
      setRequests(r);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const openReview = async (req) => {
    const items = await base44.entities.FundingRequestLineItem.filter({ funding_request_id: req.id });
    setLineItems(items);
    setSelected(req);
    setApprovedAmount(req.amount_requested);
    setNotes('');
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
    const r = await base44.entities.FundingRequest.list('-created_date', 50);
    setRequests(r);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Funding Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and process funding requests</p>
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
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
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
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openReview(req)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Review
                    </Button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No funding requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Funding Request {selected?.request_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground text-xs">Organization</Label><p className="font-medium">{selected.organization_name}</p></div>
                <div><Label className="text-muted-foreground text-xs">Type</Label><p className="font-medium">{selected.request_type}</p></div>
                <div><Label className="text-muted-foreground text-xs">Amount Requested</Label><p className="font-bold text-lg">{formatCurrency(selected.amount_requested)}</p></div>
                <div><Label className="text-muted-foreground text-xs">Period</Label><p className="font-medium">{formatDateShort(selected.period_start)} – {formatDateShort(selected.period_end)}</p></div>
              </div>

              {lineItems.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(li => (
                      <tr key={li.id} className="border-b last:border-0">
                        <td className="p-2"><span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{li.budget_category}</span></td>
                        <td className="p-2">{li.description}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div>
                <Label>Approved Amount ($)</Label>
                <Input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
              </div>
              <div>
                <Label>Reviewer Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleAction('Denied')}>Deny</Button>
                <Button variant="secondary" onClick={() => handleAction('AdditionalInfoRequested')}>Request Info</Button>
                <Button onClick={() => handleAction('Approved')}>Approve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}