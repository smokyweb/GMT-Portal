import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDateShort, createNotification } from '../lib/helpers';
import { CheckCircle2, XCircle, Clock, FileEdit, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  Draft:             { bg: 'bg-slate-100', text: 'text-slate-700', icon: Clock },
  Submitted:         { bg: 'bg-blue-100',  text: 'text-blue-700',  icon: FileEdit },
  UnderReview:       { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  Approved:          { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  Denied:            { bg: 'bg-red-100',   text: 'text-red-700',   icon: XCircle },
  RevisionRequested: { bg: 'bg-orange-100','text-orange-700': '', text: 'text-orange-700', icon: FileEdit },
};

function AmendmentStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" /> {status?.replace(/([A-Z])/g, ' $1').trim()}
    </span>
  );
}

function BeforeAfterTable({ original, proposed }) {
  const origBycat = (original || []).reduce((acc, l) => { acc[l.budget_category] = (acc[l.budget_category] || 0) + (l.amount_requested || 0); return acc; }, {});
  const propBycat = (proposed || []).reduce((acc, l) => { acc[l.budget_category] = (acc[l.budget_category] || 0) + (l.amount_requested || 0); return acc; }, {});
  const allCats = [...new Set([...Object.keys(origBycat), ...Object.keys(propBycat)])];
  const origTotal = Object.values(origBycat).reduce((s, v) => s + v, 0);
  const propTotal = Object.values(propBycat).reduce((s, v) => s + v, 0);
  const netChange = propTotal - origTotal;

  return (
    <div>
      <div className="grid grid-cols-4 text-xs px-3 py-1.5 text-muted-foreground font-medium border-b bg-muted/30">
        <span>Category</span>
        <span className="text-right">Before</span>
        <span className="text-right">After</span>
        <span className="text-right">Change</span>
      </div>
      {allCats.map(cat => {
        const orig = origBycat[cat] || 0;
        const prop = propBycat[cat] || 0;
        const diff = prop - orig;
        const isNew = !origBycat[cat];
        const isRemoved = !propBycat[cat];
        return (
          <div key={cat} className={`grid grid-cols-4 text-sm px-3 py-2.5 border-b last:border-b-0 items-center ${isNew ? 'bg-green-50/50' : isRemoved ? 'bg-red-50/50' : ''}`}>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{cat}</span>
              {isNew && <span className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded font-semibold">New</span>}
              {isRemoved && <span className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded font-semibold">Removed</span>}
            </div>
            <span className="text-right text-muted-foreground">{formatCurrency(orig)}</span>
            <span className="text-right font-medium">{formatCurrency(prop)}</span>
            <span className={`text-right font-semibold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
              {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
            </span>
          </div>
        );
      })}
      <div className="grid grid-cols-4 text-sm px-3 py-2.5 bg-muted/30 font-bold border-t">
        <span>Total</span>
        <span className="text-right">{formatCurrency(origTotal)}</span>
        <span className="text-right text-blue-700">{formatCurrency(propTotal)}</span>
        <span className={`text-right ${netChange > 0 ? 'text-amber-700' : netChange < 0 ? 'text-green-700' : ''}`}>
          {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
        </span>
      </div>
    </div>
  );
}

function LineItemComparison({ original, proposed, title, colorClass }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border overflow-hidden ${colorClass}`}>
      <button className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-black/5 transition" onClick={() => setExpanded(!expanded)}>
        <span>{title} ({(proposed || original || []).length} lines)</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && (
        <table className="w-full text-xs border-t">
          <thead><tr className="bg-muted/40"><th className="text-left p-2 font-medium">Category</th><th className="text-left p-2 font-medium">Description</th><th className="text-right p-2 font-medium">Federal</th><th className="text-right p-2 font-medium">Match</th></tr></thead>
          <tbody>
            {(proposed || original || []).map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2"><span className="px-1.5 py-0.5 bg-muted rounded">{l.budget_category}</span></td>
                <td className="p-2 text-muted-foreground">{l.line_description || '—'}</td>
                <td className="p-2 text-right font-medium">{formatCurrency(l.amount_requested)}</td>
                <td className="p-2 text-right">{formatCurrency(l.amount_match)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Full review dialog for admins
export function BudgetAmendmentReviewDialog({ amendment, open, onClose, onActioned, isAdmin = false }) {
  const [notes, setNotes] = useState('');
  const [actioning, setActioning] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    setNotes('');
  }, [amendment?.id]);

  const action = async (newStatus) => {
    setActioning(newStatus);
    try {
      await base44.entities.BudgetAmendment.update(amendment.id, {
        status: newStatus,
        reviewer_notes: notes,
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
      });
      // If approved: update the actual ApplicationBudget records with proposed lines
      if (newStatus === 'Approved' && amendment.proposed_budget_lines?.length > 0) {
        try {
          // Delete existing budget lines
          const existing = await base44.entities.ApplicationBudget.filter({ application_id: amendment.application_id }).catch(() => []);
          await Promise.all((existing || []).map(b => base44.entities.ApplicationBudget.delete(b.id).catch(() => {})));
          // Create new budget lines from proposed
          const lines = Array.isArray(amendment.proposed_budget_lines)
            ? amendment.proposed_budget_lines
            : JSON.parse(amendment.proposed_budget_lines || '[]');
          await Promise.all(lines.map(l => base44.entities.ApplicationBudget.create({
            application_id: amendment.application_id,
            budget_category: l.budget_category,
            line_description: l.line_description,
            amount_requested: Number(l.amount_requested) || 0,
            amount_match: Number(l.amount_match) || 0,
            is_allowable: true,
          })));
          // Update application: awarded_amount and performance period if changed
          try {
            // Direct fetch by ID for reliability
            let targetApp = null;
            try {
              const directResult = await base44.entities.Application.filter({ id: amendment.application_id }, '-created_date', 1);
              targetApp = Array.isArray(directResult) ? directResult[0] : null;
            } catch {}
            if (!targetApp) {
              // Fallback: list and find
              const allApps = await base44.entities.Application.list('-created_date', 1000).catch(() => []);
              targetApp = (Array.isArray(allApps) ? allApps : []).find(a => a.id === amendment.application_id);
            }
            if (targetApp) {
              const appUpdates = {};
              // Update awarded_amount: use proposed_total directly if available, otherwise add net_change
              if (amendment.proposed_total && Number(amendment.proposed_total) > 0) {
                appUpdates.awarded_amount = Number(amendment.proposed_total);
              } else if (amendment.net_change && Number(amendment.net_change) !== 0) {
                const currentAwarded = Number(targetApp.awarded_amount) || 0;
                appUpdates.awarded_amount = currentAwarded + Number(amendment.net_change);
              }
              // Update performance period if specified in amendment
              if (amendment.performance_start_new) appUpdates.performance_start = amendment.performance_start_new;
              if (amendment.performance_end_new) appUpdates.performance_end = amendment.performance_end_new;
              // Note: requested_amount stays as original request; awarded_amount reflects the new approved total
              if (Object.keys(appUpdates).length > 0) {
                await base44.entities.Application.update(amendment.application_id, appUpdates).catch(e => console.error('App update failed:', e));
              }
            }
          } catch (appErr) {
            console.error('Application update after approval failed:', appErr);
          }
        } catch (budgetErr) {
          console.error('Budget update after approval failed:', budgetErr);
        }
      }
      // Notify subrecipient of decision
      if (amendment.submitted_by) {
        const actionLabel = newStatus === 'Approved' ? 'Approved' : newStatus === 'Denied' ? 'Denied' : 'Revision Requested';
        createNotification(base44, amendment.submitted_by,
          `Budget Amendment ${actionLabel}`,
          `Your budget amendment ${amendment.amendment_number} for ${amendment.application_number} has been ${actionLabel.toLowerCase()}.${notes ? ' Reviewer notes: ' + notes : ''}`,
          'amendment_actioned', 'BudgetAmendment', amendment.id,
          '/my-applications'
        ).catch(() => {});
        base44.integrations.Core.SendEmail({
          to: amendment.submitted_by,
          subject: `Budget Amendment ${actionLabel} \u2014 ${amendment.application_number}`,
          body: `Your budget amendment (${amendment.amendment_number}) for grant ${amendment.application_number} has been ${actionLabel.toLowerCase()}.${notes ? '\n\nReviewer Notes: ' + notes : ''}\n\nLog in to the GMT Portal for details.`,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Amendment action error:', err);
      alert('Failed to save: ' + (err?.message || 'Please try again.'));
    } finally {
      setActioning(null);
      onActioned?.();
      onClose();
    }
  };

  if (!amendment) return null;

  const isPending = ['Submitted', 'UnderReview'].includes(amendment.status);
  const isRevisionRequested = amendment.status === 'RevisionRequested';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Budget Amendment — {amendment.amendment_number}</span>
            <AmendmentStatusBadge status={amendment.status} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {amendment.organization_name} · App {amendment.application_number} · Submitted {formatDateShort(amendment.submitted_at)} by {amendment.submitted_by}
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Current Budget</p>
              <p className="font-bold">{formatCurrency(amendment.original_total)}</p>
            </div>
            <div className={`rounded-lg p-3 ${(amendment.net_change || 0) > 0 ? 'bg-amber-50 border border-amber-200' : (amendment.net_change || 0) < 0 ? 'bg-green-50 border border-green-200' : 'bg-muted/40'}`}>
              <p className="text-xs text-muted-foreground">Net Change</p>
              <p className={`font-bold ${(amendment.net_change || 0) > 0 ? 'text-amber-700' : (amendment.net_change || 0) < 0 ? 'text-green-700' : ''}`}>
                {(amendment.net_change || 0) >= 0 ? '+' : ''}{formatCurrency(amendment.net_change || 0)}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Proposed Budget</p>
              <p className="font-bold text-blue-700">{formatCurrency(amendment.proposed_total)}</p>
            </div>
          </div>

          {/* Before / After comparison table */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Category Comparison</h3>
            <div className="rounded-lg border overflow-hidden">
              <BeforeAfterTable
                original={amendment.original_budget_snapshot}
                proposed={amendment.proposed_budget_lines}
              />
            </div>
          </div>

          {/* Expandable line-by-line detail */}
          <div className="space-y-2">
            <LineItemComparison original={amendment.original_budget_snapshot} title="Current Budget Lines" colorClass="border-slate-200" />
            <LineItemComparison proposed={amendment.proposed_budget_lines} title="Proposed Budget Lines" colorClass="border-blue-200 bg-blue-50/30" />
          </div>

                    {/* Performance Period Change (if requested) */}
          {(amendment.performance_start_new || amendment.performance_end_new) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Performance Period Change Requested</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {amendment.performance_start_new && (
                  <div><p className="text-xs text-muted-foreground">New Start Date</p><p className="font-medium">{amendment.performance_start_new}</p></div>
                )}
                {amendment.performance_end_new && (
                  <div><p className="text-xs text-muted-foreground">New End Date</p><p className="font-medium">{amendment.performance_end_new}</p></div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2">Approving will update the application performance period dates.</p>
            </div>
          )}

{/* Justification fields */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Justification</p>
              <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">{amendment.justification || '—'}</div>
            </div>
            {amendment.impact_on_scope && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Impact on Scope of Work</p>
                <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">{amendment.impact_on_scope}</div>
              </div>
            )}
            {amendment.impact_on_timeline && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Impact on Timeline</p>
                <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">{amendment.impact_on_timeline}</div>
              </div>
            )}
          </div>

          {/* Reviewer notes - always show if present */}
          {amendment.reviewer_notes && (
            <div className={`border rounded-lg p-3 ${isRevisionRequested ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-xs font-semibold mb-1 ${isRevisionRequested ? 'text-orange-700' : 'text-amber-700'}`}>
                {isRevisionRequested ? 'Revision Requested — Reviewer Notes' : 'Reviewer Notes'}
              </p>
              <p className={`text-sm ${isRevisionRequested ? 'text-orange-800' : 'text-amber-800'}`}>{amendment.reviewer_notes}</p>
              <p className={`text-xs mt-1 ${isRevisionRequested ? 'text-orange-600' : 'text-amber-600'}`}>— {amendment.reviewed_by} · {formatDateShort(amendment.reviewed_at)}</p>
            </div>
          )}

          {/* Subrecipient resubmit when revision is requested */}
          {isRevisionRequested && !isAdmin && (
            <div className="border border-orange-200 rounded-lg p-4 space-y-3 bg-orange-50">
              <p className="text-sm font-semibold text-orange-800">Action Required: Please revise and resubmit your amendment</p>
              <Textarea
                rows={3}
                placeholder="Describe the revisions you made…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <Button
                className="bg-orange-600 hover:bg-orange-700"
                disabled={!!actioning}
                onClick={async () => {
                  setActioning('Resubmit');
                  try {
                    await base44.entities.BudgetAmendment.update(amendment.id, {
                      status: 'Submitted',
                      justification: (amendment.justification || '') + (notes ? '\n\n[Revision]: ' + notes : ''),
                      submitted_at: new Date().toISOString(),
                    });
                    onActioned?.();
                    onClose();
                  } catch(e) { alert('Resubmit failed.'); }
                  finally { setActioning(null); }
                }}
              >
                {actioning === 'Resubmit' ? 'Resubmitting…' : 'Resubmit Amendment'}
              </Button>
            </div>
          )}

          {/* Show resubmission notice when amendment was revised and resubmitted */}
          {isPending && isAdmin && amendment.reviewer_notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">&#x21BA; Resubmitted After Revision</p>
              <p className="text-xs text-blue-600">The subrecipient has addressed your revision request and resubmitted this amendment for your review.</p>
            </div>
          )}

          {/* Admin action area - only shown for admins */}
          {isPending && isAdmin && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <Label>Reviewer Notes (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Add notes for the subrecipient explaining your decision…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => action('RevisionRequested')} disabled={!!actioning}>
                  {actioning === 'RevisionRequested' ? 'Saving…' : 'Request Revision'}
                </Button>
                <Button variant="destructive" onClick={() => action('Denied')} disabled={!!actioning}>
                  {actioning === 'Denied' ? 'Saving…' : <><XCircle className="h-4 w-4 mr-1.5" /> Deny</>}
                </Button>
                <Button onClick={() => action('Approved')} disabled={!!actioning} className="bg-green-600 hover:bg-green-700">
                  {actioning === 'Approved' ? 'Saving…' : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve</>}
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// List widget for embedding in pages
export default function BudgetAmendmentReview({ applicationId, isAdmin = false, user: propUser }) {
  const [amendments, setAmendments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    base44.entities.BudgetAmendment.filter({ application_id: applicationId }, '-created_date', 20)
      .then(a => { setAmendments(a); setLoading(false); });
  };

  useEffect(() => { if (applicationId) load(); }, [applicationId]);

  if (loading) return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (amendments.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No budget amendments for this application.</p>;
  }

  return (
    <div className="space-y-2">
      {amendments.map(am => (
        <div key={am.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/20 transition">
          <div className="min-w-0">
            <p className="text-sm font-semibold font-mono">{am.amendment_number}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateShort(am.submitted_at)} · {formatCurrency(am.original_total)} → {formatCurrency(am.proposed_total)}
              {am.net_change != null && (
                <span className={`ml-2 font-semibold ${am.net_change > 0 ? 'text-amber-700' : am.net_change < 0 ? 'text-green-700' : ''}`}>
                  ({am.net_change >= 0 ? '+' : ''}{formatCurrency(am.net_change)})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AmendmentStatusBadge status={am.status} />
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelected(am)}>
              {isAdmin && ['Submitted', 'UnderReview'].includes(am.status) ? 'Review' : 'View'}
            </Button>
          </div>
        </div>
      ))}

      <BudgetAmendmentReviewDialog
        amendment={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onActioned={() => { setSelected(null); load(); }}
        isAdmin={isAdmin}
      />
    </div>
  );
}