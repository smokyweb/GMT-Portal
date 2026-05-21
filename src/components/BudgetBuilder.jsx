import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Trash2, Plus, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Info, DollarSign, TrendingUp, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../lib/helpers';

const BUDGET_CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];

const CATEGORY_HINTS = {
  Personnel: 'Salaries, wages, fringe benefits for staff directly supporting the grant.',
  Equipment: 'Items with unit cost ≥ $5,000 and useful life > 1 year (e.g. vehicles, hardware).',
  Training: 'Courses, exercises, workshops, and associated materials.',
  Travel: 'Transportation, lodging, and per diem for grant-related activities.',
  Contractual: 'Vendor contracts, professional services, consultants.',
  Planning: 'Planning activities, assessments, strategy documents.',
  Other: 'Direct costs not fitting other categories. Provide a clear justification.',
};

function CategoryRow({ item, idx, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(!item.line_description);
  const amount = Number(item.amount_requested) || 0;
  const match = Number(item.amount_match) || 0;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'shadow-sm' : ''}`}>
      {/* Row Header */}
      <div
        className="flex items-center gap-3 p-3 bg-card cursor-pointer hover:bg-muted/30 transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
            {item.budget_category}
          </span>
          <span className="text-sm truncate text-muted-foreground">
            {item.line_description || <em className="text-muted-foreground/60">No description yet</em>}
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {amount > 0 && (
            <span className="text-sm font-semibold text-foreground">{formatCurrency(amount)}</span>
          )}
          {!item.line_description && (
            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
              Incomplete
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Form */}
      {expanded && (
        <div className="border-t bg-muted/20 p-4 space-y-4">
          {/* Category + hint */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Select value={item.budget_category} onValueChange={v => onUpdate(idx, 'budget_category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 w-full">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{CATEGORY_HINTS[item.budget_category]}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Line Item Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={item.line_description}
              onChange={e => onUpdate(idx, 'line_description', e.target.value)}
              placeholder="Describe this line item, how it supports the grant objectives, and what will be purchased or funded..."
              rows={2}
            />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Federal Request ($) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={item.amount_requested || ''}
                onChange={e => onUpdate(idx, 'amount_requested', e.target.value)}
                placeholder="0.00"
                className="text-right"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Match / Cost-Share ($)
              </label>
              <Input
                type="number"
                min="0"
                value={item.amount_match || ''}
                onChange={e => onUpdate(idx, 'amount_match', e.target.value)}
                placeholder="0.00"
                className="text-right"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onRemove(idx)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove Line Item
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetBuilder({ items, onChange, nofo }) {
  const maxAward = nofo?.max_award || 0;
  const minAward = nofo?.min_award || 0;
  const totalFunding = nofo?.total_funding_available || 0;

  const totals = useMemo(() => {
    const requested = items.reduce((s, b) => s + (Number(b.amount_requested) || 0), 0);
    const match = items.reduce((s, b) => s + (Number(b.amount_match) || 0), 0);
    const byCategory = BUDGET_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = items.filter(i => i.budget_category === cat).reduce((s, i) => s + (Number(i.amount_requested) || 0), 0);
      return acc;
    }, {});
    return { requested, match, byCategory };
  }, [items]);

  // Validation checks
  const validations = useMemo(() => {
    const issues = [];
    const warnings = [];

    if (items.length === 0) {
      issues.push('Add at least one budget line item.');
    }

    items.forEach((item, i) => {
      if (!item.line_description?.trim()) {
        issues.push(`Line item ${i + 1} (${item.budget_category}) is missing a description.`);
      }
      if (!Number(item.amount_requested)) {
        issues.push(`Line item ${i + 1} (${item.budget_category}) has no requested amount.`);
      }
    });

    if (maxAward > 0 && totals.requested > maxAward) {
      issues.push(`Total request (${formatCurrency(totals.requested)}) exceeds the NOFO maximum award of ${formatCurrency(maxAward)}.`);
    }
    if (minAward > 0 && totals.requested > 0 && totals.requested < minAward) {
      warnings.push(`Total request (${formatCurrency(totals.requested)}) is below the NOFO minimum award of ${formatCurrency(minAward)}.`);
    }
    if (totalFunding > 0 && totals.requested > totalFunding) {
      issues.push(`Total request exceeds total program funding available (${formatCurrency(totalFunding)}).`);
    }

    const incomplete = items.filter(i => !i.line_description?.trim() || !Number(i.amount_requested));
    if (incomplete.length > 0) {
      warnings.push(`${incomplete.length} line item${incomplete.length > 1 ? 's are' : ' is'} incomplete.`);
    }

    return { issues, warnings, valid: issues.length === 0 };
  }, [items, totals, maxAward, minAward, totalFunding]);

  const addItem = () => {
    onChange([...items, { budget_category: 'Personnel', line_description: '', amount_requested: 0, amount_match: 0, isExisting: false }]);
  };

  const updateItem = (idx, field, value) => {
    onChange(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const usedCategories = BUDGET_CATEGORIES.filter(c => totals.byCategory[c] > 0);

  return (
    <div className="space-y-6">
      {/* NOFO Budget Caps Banner */}
      {nofo && (maxAward > 0 || minAward > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {maxAward > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Max Award</p>
              <p className="text-base font-bold text-blue-800">{formatCurrency(maxAward)}</p>
            </div>
          )}
          {minAward > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Min Award</p>
              <p className="text-base font-bold text-blue-800">{formatCurrency(minAward)}</p>
            </div>
          )}
          {totalFunding > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Total Funding Available</p>
              <p className="text-base font-bold text-blue-800">{formatCurrency(totalFunding)}</p>
            </div>
          )}
        </div>
      )}

      {/* Running Total Bar */}
      {items.length > 0 && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Budget Summary</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold">{formatCurrency(totals.requested)}</span>
              <span className="text-xs text-muted-foreground ml-1">requested</span>
              {totals.match > 0 && (
                <span className="text-xs text-muted-foreground ml-3">+ {formatCurrency(totals.match)} match</span>
              )}
            </div>
          </div>

          {/* Cap progress bar */}
          {maxAward > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>vs. Max Award Cap</span>
                <span className={totals.requested > maxAward ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                  {Math.round((totals.requested / maxAward) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totals.requested > maxAward ? 'bg-red-500' : totals.requested > maxAward * 0.9 ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, (totals.requested / maxAward) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {usedCategories.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {usedCategories.map(cat => (
                <div key={cat} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1 text-xs">
                  <span className="font-medium">{cat}</span>
                  <span className="text-muted-foreground">{formatCurrency(totals.byCategory[cat])}</span>
                  <span className="text-muted-foreground/60">
                    ({Math.round((totals.byCategory[cat] / totals.requested) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation Messages */}
      {validations.issues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-3.5 w-3.5" /> Issues to resolve before submitting
          </p>
          {validations.issues.map((msg, i) => (
            <p key={i} className="text-xs text-red-700 flex items-start gap-1.5">
              <span className="mt-0.5">•</span> {msg}
            </p>
          ))}
        </div>
      )}
      {validations.warnings.length > 0 && validations.issues.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Warnings
          </p>
          {validations.warnings.map((msg, i) => (
            <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
              <span className="mt-0.5">•</span> {msg}
            </p>
          ))}
        </div>
      )}
      {validations.valid && items.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-700 font-medium">Budget looks good! All line items are complete and within NOFO caps.</p>
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <CategoryRow key={idx} item={item} idx={idx} onUpdate={updateItem} onRemove={removeItem} />
        ))}

        {items.length === 0 && (
          <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">No budget line items yet</p>
            <p className="text-xs mt-1 mb-4">Add line items for each category of spending.</p>
            <Button variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1.5" /> Add First Line Item
            </Button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <Button variant="outline" onClick={addItem} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-1.5" /> Add Another Line Item
        </Button>
      )}
    </div>
  );
}