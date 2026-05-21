import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDateShort } from '../lib/helpers';
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
export function BudgetAmendmentReviewDialog({ amendment, open, onClose, onActioned }) {
  const [notes, setNotes] = useState('');
  const [actioning, setActioning] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    setNotes('');
  }, [amendment?.id]);

  const action = async (newStatus) => {
    setActioning(newStatus);
    await base44.entities.BudgetAmendment.update(amendment.id, {
      status: newStatus,
      reviewer_notes: notes,
      reviewed_by: user?.email,
      reviewed_at: new Date().toISOString(),
    });
    setActioning(null);
    onActioned?.();
    onClose();
  };

  if (!amendment) return null;

  const isPending = ['Submitted', 'UnderReview'].includes(amendment.status);

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

          {/* Prior reviewer notes if already actioned */}
          {amendment.reviewer_notes && !isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Reviewer Notes</p>
              <p className="text-sm text-amber-800">{amendment.reviewer_notes}</p>
              <p className="text-xs text-amber-600 mt-1">— {amendment.reviewed_by} · {formatDateShort(amendment.reviewed_at)}</p>
            </div>
          )}

          {/* Admin action area */}
          {isPending && (
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
export default function BudgetAmendmentReview({ applicationId, isAdmin = false }) {
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
      />
    </div>
  );
}