import { useState } from 'react';
import { toast } from '@/components/ui/toast-simple';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const STEP_STATUS_COLORS = {
  Approved: 'text-green-700 bg-green-100 border-green-200',
  Rejected: 'text-red-700 bg-red-100 border-red-200',
  Pending: 'text-amber-700 bg-amber-50 border-amber-200',
};

function StepBadge({ status }) {
  const cls = STEP_STATUS_COLORS[status] || STEP_STATUS_COLORS.Pending;
  const Icon = status === 'Approved' ? CheckCircle : status === 'Rejected' ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="h-3 w-3" />
      {status || 'Pending'}
    </span>
  );
}

export default function MultiStepApprovalPanel({ selected, user, onComplete }) {
  const [actionStep, setActionStep] = useState(null); // 'pm' | 'fo'
  const [actionType, setActionType] = useState(''); // 'Approved' | 'Rejected'
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(selected.payment_method || '');
  const [amountPaid, setAmountPaid] = useState(selected.amount_paid ?? selected.amount_approved ?? '');
  const [paymentReference, setPaymentReference] = useState(selected.payment_reference || '');
  const [paymentDate, setPaymentDate] = useState(selected.payment_date || '');
  const [submitting, setSubmitting] = useState(false);

  const isPM = user?.role === 'program_manager' || user?.role === 'admin';
  const isFO = user?.role === 'finance_officer' || user?.role === 'admin';

  const canActPM = isPM && selected.payment_status === 'PendingPMApproval';
  const canActFO = isFO && selected.payment_status === 'PendingFOApproval';

  const handleSubmit = async () => {
    setSubmitting(true);
    let completed = false;
    try {
      const now = new Date().toISOString();
      const updates = {};
      if (actionStep === 'pm') {
        updates.pm_approved_by = user?.email;
        updates.pm_approved_at = now;
        updates.pm_approval_notes = notes;
        updates.payment_status = actionType === 'Approved' ? 'PendingFOApproval' : 'PaymentFailed';
      } else if (actionStep === 'fo') {
        if (actionType === 'Approved' && (!paymentMethod || amountPaid === '' || amountPaid === null || !Number.isFinite(Number(amountPaid)) || Number(amountPaid) < 0 || !paymentDate)) {
          toast('Payment method, paid amount, and payment date are required when marking a request as Paid.', 'error');
          setSubmitting(false);
          return;
        }
        updates.fo_approved_by = user?.email;
        updates.fo_approved_at = now;
        updates.fo_approval_notes = notes;
        updates.payment_status = actionType === 'Approved' ? 'Paid' : 'PaymentFailed';
        if (actionType === 'Approved') {
          updates.payment_method = paymentMethod;
          updates.amount_paid = Number(amountPaid);
          updates.payment_reference = paymentReference || null;
          updates.payment_date = paymentDate;
        }
      }
      await base44.entities.FundingRequest.update(selected.id, updates);
      completed = true;
    } catch (err) {
      console.error('MultiStep approval error:', err);
      toast('Failed to save approval: ' + (err?.detail || err?.message || 'Please try again.', 'error'));
    } finally {
      setActionStep(null);
      setNotes('');
      setActionType('');
      setSubmitting(false);
      if (completed) onComplete();
    }
  };

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-4">
      <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm">
        <ShieldCheck className="h-4 w-4" />
        Multi-Step Payment Approval Required
      </div>

      {/* Step 1: Program Manager */}
      <div className="bg-white rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Step 1 - Program Manager
          </div>
          <StepBadge status={selected.pm_approval_status || 'Pending'} />
        </div>
        {selected.pm_approved_by && (
          <p className="text-xs text-muted-foreground">
            By <span className="font-medium text-foreground">{selected.pm_approved_by}</span>
            {selected.pm_approved_at && ` on ${new Date(selected.pm_approved_at).toLocaleDateString()}`}
            {selected.pm_notes && ` - ${selected.pm_notes}`}
          </p>
        )}
        {canActPM && !actionStep && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setActionStep('pm'); setActionType('Approved'); }}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setActionStep('pm'); setActionType('Rejected'); }}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>

      {/* Step 2: Finance Officer */}
      <div className="bg-white rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Step 2 - Finance Officer
          </div>
          <StepBadge status={selected.fo_approval_status || 'Pending'} />
        </div>
        {selected.fo_approved_by && (
          <p className="text-xs text-muted-foreground">
            By <span className="font-medium text-foreground">{selected.fo_approved_by}</span>
            {selected.fo_approved_at && ` on ${new Date(selected.fo_approved_at).toLocaleDateString()}`}
            {selected.fo_notes && ` - ${selected.fo_notes}`}
          </p>
        )}
        {canActFO && !actionStep && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setActionStep('fo'); setActionType('Approved'); }}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setActionStep('fo'); setActionType('Rejected'); }}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
        {!canActFO && selected.payment_status === 'PendingFOApproval' && !actionStep && (
          <p className="text-xs text-muted-foreground italic">Waiting for a Finance Officer to action this step.</p>
        )}
        {selected.payment_status === 'PendingPMApproval' && !selected.pm_approval_status && (
          <p className="text-xs text-muted-foreground italic">Waiting for Program Manager approval first.</p>
        )}
      </div>

      {/* Confirm action form */}
      {actionStep && (
        <>
      <div className={`rounded-lg border p-3 space-y-3 ${actionType === 'Approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <p className="text-sm font-medium">
            {actionType === 'Approved' ? '✓' : '✗'} Confirm {actionType} - {actionStep === 'pm' ? 'Program Manager' : 'Finance Officer'} Step
          </p>
        <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              className="mt-1 bg-white"
              rows={2}
              placeholder="Add any notes for this decision..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setActionStep(null); setActionType(''); setNotes(''); }}>Cancel</Button>
            <Button
              size="sm"
              disabled={submitting}
              className={actionType === 'Approved' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={handleSubmit}
            >
              {submitting ? 'Saving…' : `Confirm ${actionType}`}
            </Button>
          </div>
        </div>
        {actionStep === 'fo' && actionType === 'Approved' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment Method <span className="text-red-500">*</span></Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="">Select method...</option><option value="EFT">EFT</option><option value="Check">Check</option><option value="Multiple Payables">Multiple Payables</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Amount Paid <span className="text-red-500">*</span></Label>
              <Input type="number" min="0" step="0.01" className="mt-1 bg-white text-right" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Payment # (EFT / Check)</Label>
              <Input className="mt-1 bg-white" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Payment Date <span className="text-red-500">*</span></Label>
              <Input type="date" className="mt-1 bg-white" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            {Number.isFinite(Number(amountPaid)) && selected.amount_approved != null && Math.abs(Number(amountPaid) - Number(selected.amount_approved)) > 0.005 && <p className="col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">Warning: paid amount differs from approved amount ({Number(selected.amount_approved).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}).</p>}
          </div>
        )}
        </>
      )}
    </div>
  );
}
