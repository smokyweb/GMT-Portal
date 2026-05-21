import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BadgeDollarSign, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { toast } from 'sonner';

export default function CreditApplicationPanel({ organizationId, fundingRequest, user, onApplied }) {
  const [credits, setCredits] = useState([]);
  const [appliedCredits, setAppliedCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyDialog, setApplyDialog] = useState(null);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!organizationId || !fundingRequest?.id) return;
    load();
  }, [organizationId, fundingRequest?.id]);

  const load = async () => {
    const [c, a] = await Promise.all([
      base44.entities.Credit.filter({ organization_id: organizationId }),
      base44.entities.CreditApplication.filter({ funding_request_id: fundingRequest.id }),
    ]);
    setCredits(c.filter(cr => cr.status === 'Active' || cr.status === 'PartiallyUsed'));
    setAppliedCredits(a);
    setLoading(false);
  };

  const handleApply = async () => {
    const amt = Number(applyAmount);
    if (!amt || amt <= 0 || amt > applyDialog.amount_remaining) return;
    setSubmitting(true);

    await base44.entities.CreditApplication.create({
      credit_id: applyDialog.id,
      credit_number: applyDialog.credit_number,
      funding_request_id: fundingRequest.id,
      funding_request_number: fundingRequest.request_number,
      organization_id: organizationId,
      organization_name: fundingRequest.organization_name,
      amount_applied: amt,
      applied_by: user.email,
      note: applyNote,
    });

    const newRemaining = (applyDialog.amount_remaining || 0) - amt;
    const newStatus = newRemaining <= 0 ? 'FullyRedeemed' : 'PartiallyUsed';
    await base44.entities.Credit.update(applyDialog.id, {
      amount_remaining: Math.max(0, newRemaining),
      status: newStatus,
    });

    await logAudit(base44, user, 'CreditApplied', 'Credit', applyDialog.id,
      `Applied ${formatCurrency(amt)} from credit ${applyDialog.credit_number} to request ${fundingRequest.request_number}`);

    // Notify state admins
    const users = await base44.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');
    for (const a of admins) {
      await createNotification(base44, a.email, 'Credit Applied to Funding Request',
        `${fundingRequest.organization_name} applied ${formatCurrency(amt)} from credit ${applyDialog.credit_number} to request ${fundingRequest.request_number}.`,
        'credit_applied', 'Credit', applyDialog.id, '/credits');
    }

    toast.success(`Applied ${formatCurrency(amt)} from credit ${applyDialog.credit_number}`);
    setSubmitting(false);
    setApplyDialog(null);
    setApplyAmount('');
    setApplyNote('');
    load();
    onApplied?.();
  };

  if (loading) return <div className="flex justify-center py-4"><div className="w-5 h-5 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const totalApplied = appliedCredits.reduce((s, a) => s + (a.amount_applied || 0), 0);

  return (
    <div className="space-y-4">
      {/* Already applied credits */}
      {appliedCredits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Credits Applied to This Request</p>
          <div className="space-y-2">
            {appliedCredits.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border bg-green-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="font-mono font-medium">{a.credit_number}</span>
                  {a.note && <span className="text-xs text-muted-foreground">— {a.note}</span>}
                </div>
                <span className="font-semibold text-green-700">−{formatCurrency(a.amount_applied)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span>Total Credits Applied</span>
              <span className="text-green-700">−{formatCurrency(totalApplied)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Available credits to apply */}
      {credits.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Available Credits</p>
          <div className="space-y-2">
            {credits.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-card">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BadgeDollarSign className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-mono text-sm font-semibold">{c.credit_number}</span>
                    <span className="text-xs text-muted-foreground">— {formatCurrency(c.amount_remaining)} remaining</span>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{c.description}</p>}
                  {c.expiration_date && <p className="text-xs text-amber-600 mt-0.5 ml-6">Expires {formatDateShort(c.expiration_date)}</p>}
                </div>
                <Button size="sm" variant="outline" className="ml-3 flex-shrink-0"
                  onClick={() => { setApplyDialog(c); setApplyAmount(String(c.amount_remaining)); setApplyNote(''); }}>
                  Apply
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No available credits for your organization.</p>
      )}

      {/* Apply Dialog */}
      <Dialog open={!!applyDialog} onOpenChange={() => setApplyDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Credit {applyDialog?.credit_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground">Credit Balance</p><p className="font-semibold">{formatCurrency(applyDialog?.amount_remaining)}</p></div>
              <div><p className="text-xs text-muted-foreground">Request Amount</p><p className="font-semibold">{formatCurrency(fundingRequest?.amount_requested)}</p></div>
            </div>
            <div>
              <Label>Amount to Apply ($) <span className="text-red-500">*</span></Label>
              <Input className="mt-1" type="number" placeholder="0.00"
                value={applyAmount} onChange={e => setApplyAmount(e.target.value)}
                max={applyDialog?.amount_remaining} />
              {Number(applyAmount) > (applyDialog?.amount_remaining || 0) && (
                <p className="text-xs text-red-500 mt-1">Cannot exceed available credit balance.</p>
              )}
            </div>
            <div>
              <Label>Note <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input className="mt-1" placeholder="Optional note…" value={applyNote} onChange={e => setApplyNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(null)}>Cancel</Button>
            <Button onClick={handleApply}
              disabled={submitting || !applyAmount || Number(applyAmount) <= 0 || Number(applyAmount) > (applyDialog?.amount_remaining || 0)}>
              {submitting ? 'Applying…' : `Apply ${applyAmount ? formatCurrency(Number(applyAmount)) : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}