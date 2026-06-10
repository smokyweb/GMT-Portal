import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

const BUDGET_CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];

function LineItemEditor({ items, onChange }) {
  const addLine = () => onChange([...items, { budget_category: 'Personnel', line_description: '', amount_requested: 0, amount_match: 0 }]);
  const update = (idx, field, val) => onChange(items.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3">
            <Select value={item.budget_category} onValueChange={v => update(idx, 'budget_category', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-4">
            <Input
              className="h-8 text-xs"
              placeholder="Description"
              value={item.line_description}
              onChange={e => update(idx, 'line_description', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number"
              className="h-8 text-xs text-right"
              placeholder="Federal $"
              value={item.amount_requested}
              onChange={e => update(idx, 'amount_requested', Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number"
              className="h-8 text-xs text-right"
              placeholder="Match $"
              value={item.amount_match}
              onChange={e => update(idx, 'amount_match', Number(e.target.value))}
            />
          </div>
          <div className="col-span-1 flex justify-center">
            <button onClick={() => remove(idx)} className="text-muted-foreground hover:text-red-500 transition">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLine} className="w-full text-xs h-8 mt-1">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
      </Button>
    </div>
  );
}

export default function BudgetAmendmentDialog({ application, open, onClose, onSubmitted }) {
  const [step, setStep] = useState(1); // 1=justification, 2=proposed budget, 3=review
  const [originalBudget, setOriginalBudget] = useState([]);
  const [proposedLines, setProposedLines] = useState([]);
  const [form, setForm] = useState({ justification: '', impact_on_scope: '', impact_on_timeline: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !application?.id) return;
    setStep(1);
    setForm({ justification: '', impact_on_scope: '', impact_on_timeline: '' });
    base44.entities.ApplicationBudget.filter({ application_id: application.id })
      .then(items => {
        setOriginalBudget(items);
        // Pre-fill proposed with copies of existing lines
        setProposedLines(items.map(it => ({
          budget_category: it.budget_category,
          line_description: it.line_description || '',
          amount_requested: it.amount_requested || 0,
          amount_match: it.amount_match || 0,
        })));
        setLoading(false);
      });
  }, [open, application?.id]);

  const originalTotal = originalBudget.reduce((s, l) => s + (Number(l.amount_requested) || 0), 0);
  const proposedTotal = proposedLines.reduce((s, l) => s + (Number(l.amount_requested) || 0), 0);
  const netChange = proposedTotal - originalTotal;

  const handleSubmit = async () => {
    setSubmitting(true);
    const user = await base44.auth.me();
    const amendmentNumber = `BA-${application.application_number || application.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    await base44.entities.BudgetAmendment.create({
      application_id: application.id,
      application_number: application.application_number,
      organization_id: application.organization_id,
      organization_name: application.organization_name,
      submitted_by: user.email,
      amendment_number: amendmentNumber,
      justification: form.justification,
      impact_on_scope: form.impact_on_scope,
      impact_on_timeline: form.impact_on_timeline,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      original_budget_snapshot: originalBudget.map(l => ({
        budget_category: l.budget_category,
        line_description: l.line_description,
        amount_requested: l.amount_requested,
        amount_match: l.amount_match,
      })),
      proposed_budget_lines: proposedLines,
      original_total: originalTotal,
      proposed_total: proposedTotal,
      net_change: netChange,
    });
    setSubmitting(false);
    onSubmitted?.();
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Budget Amendment Request</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Application {application?.application_number} · {application?.project_title}
          </p>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {['Justification', 'Proposed Budget', 'Review & Submit'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${step === i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              {i < 2 && <div className="h-px w-6 bg-border flex-shrink-0" />}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Step 1: Justification */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Budget amendments require program manager approval. Provide a clear justification explaining why this change is necessary.</span>
                </div>
                <div>
                  <Label>Justification <span className="text-red-500">*</span></Label>
                  <Textarea
                    className="mt-1"
                    rows={4}
                    placeholder="Explain why this budget amendment is necessary. Be specific about the factors that require this change (e.g., price increases, revised scope, unforeseen costs)."
                    value={form.justification}
                    onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Impact on Scope of Work</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="Describe how this budget change affects the project scope. If there is no impact, state 'No impact on scope.'"
                    value={form.impact_on_scope}
                    onChange={e => setForm(f => ({ ...f, impact_on_scope: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Impact on Project Timeline</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="Describe how this change affects the project timeline. If no impact, state 'No impact on timeline.'"
                    value={form.impact_on_timeline}
                    onChange={e => setForm(f => ({ ...f, impact_on_timeline: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Proposed Budget */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Edit the budget lines below to reflect your proposed changes. The original budget is shown for reference.
                </div>

                {/* Original budget (read-only) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Current Approved Budget</h3>
                    <span className="text-xs font-bold">{formatCurrency(originalTotal)}</span>
                  </div>
                  <div className="rounded-lg border overflow-hidden bg-muted/20">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/40"><th className="text-left p-2 font-medium">Category</th><th className="text-left p-2 font-medium">Description</th><th className="text-right p-2 font-medium">Federal</th><th className="text-right p-2 font-medium">Match</th></tr></thead>
                      <tbody>
                        {originalBudget.length === 0
                          ? <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No budget lines on record.</td></tr>
                          : originalBudget.map((l, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-2"><span className="px-1.5 py-0.5 bg-muted rounded text-xs">{l.budget_category}</span></td>
                              <td className="p-2 text-muted-foreground">{l.line_description || '—'}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(l.amount_requested)}</td>
                              <td className="p-2 text-right">{formatCurrency(l.amount_match)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Proposed budget (editable) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Proposed Budget</h3>
                    <span className={`text-xs font-bold ${netChange > 0 ? 'text-amber-700' : netChange < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {formatCurrency(proposedTotal)} ({netChange >= 0 ? '+' : ''}{formatCurrency(netChange)})
                    </span>
                  </div>
                  <div className="grid grid-cols-12 gap-2 mb-1 px-0.5">
                    <span className="col-span-3 text-xs text-muted-foreground font-medium">Category</span>
                    <span className="col-span-4 text-xs text-muted-foreground font-medium">Description</span>
                    <span className="col-span-2 text-xs text-muted-foreground font-medium text-right">Federal $</span>
                    <span className="col-span-2 text-xs text-muted-foreground font-medium text-right">Match $</span>
                  </div>
                  <LineItemEditor items={proposedLines} onChange={setProposedLines} />
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Before vs. After Summary</h3>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="bg-card border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Current Total</p>
                      <p className="font-bold mt-0.5">{formatCurrency(originalTotal)}</p>
                    </div>
                    <div className={`border rounded-lg p-3 ${netChange > 0 ? 'bg-amber-50 border-amber-200' : netChange < 0 ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
                      <p className="text-xs text-muted-foreground">Net Change</p>
                      <p className={`font-bold mt-0.5 ${netChange > 0 ? 'text-amber-700' : netChange < 0 ? 'text-green-700' : ''}`}>
                        {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Proposed Total</p>
                      <p className="font-bold mt-0.5 text-blue-700">{formatCurrency(proposedTotal)}</p>
                    </div>
                  </div>

                  {/* Category-level diff */}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Category Changes</p>
                    {(() => {
                      const origBycat = originalBudget.reduce((acc, l) => { acc[l.budget_category] = (acc[l.budget_category] || 0) + (l.amount_requested || 0); return acc; }, {});
                      const propBycat = proposedLines.reduce((acc, l) => { acc[l.budget_category] = (acc[l.budget_category] || 0) + (l.amount_requested || 0); return acc; }, {});
                      const allCats = [...new Set([...Object.keys(origBycat), ...Object.keys(propBycat)])];
                      return (
                        <div className="divide-y rounded-lg border overflow-hidden">
                          {allCats.map(cat => {
                            const orig = origBycat[cat] || 0;
                            const prop = propBycat[cat] || 0;
                            const diff = prop - orig;
                            return (
                              <div key={cat} className="grid grid-cols-4 text-xs p-2.5 items-center bg-card">
                                <span className="font-medium">{cat}</span>
                                <span className="text-right text-muted-foreground">{formatCurrency(orig)}</span>
                                <span className="text-right text-muted-foreground">{formatCurrency(prop)}</span>
                                <span className={`text-right font-semibold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                                  {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                                </span>
                              </div>
                            );
                          })}
                          <div className="grid grid-cols-4 text-xs p-2.5 items-center bg-muted/30 font-bold">
                            <span>Total</span>
                            <span className="text-right">{formatCurrency(originalTotal)}</span>
                            <span className="text-right text-blue-700">{formatCurrency(proposedTotal)}</span>
                            <span className={`text-right ${netChange > 0 ? 'text-amber-700' : netChange < 0 ? 'text-green-700' : ''}`}>
                              {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-4 text-xs px-2.5 mt-1 text-muted-foreground">
                      <span />
                      <span className="text-right">Current</span>
                      <span className="text-right">Proposed</span>
                      <span className="text-right">Change</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Justification</p>
                    <p className="bg-muted/40 rounded-lg p-3 mt-1 text-sm whitespace-pre-wrap">{form.justification}</p>
                  </div>
                  {form.impact_on_scope && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Impact on Scope</p>
                      <p className="bg-muted/40 rounded-lg p-3 mt-1 text-sm whitespace-pre-wrap">{form.impact_on_scope}</p>
                    </div>
                  )}
                  {form.impact_on_timeline && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Impact on Timeline</p>
                      <p className="bg-muted/40 rounded-lg p-3 mt-1 text-sm whitespace-pre-wrap">{form.impact_on_timeline}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Once submitted, this amendment will be sent to your program manager for review. You'll be notified of the decision.</span>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          <div className="flex gap-2">
            {step < 3 && (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !form.justification.trim()}
              >
                Next →
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Amendment'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}