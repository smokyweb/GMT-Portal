import { Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { getFieldsForSource } from '../../lib/reportDataSources';

const TEXT_OPS = [
  { value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' }, { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_blank', label: 'is blank' }, { value: 'is_not_blank', label: 'is not blank' },
];
const NUMBER_OPS = [
  { value: 'equals', label: 'equals' }, { value: 'not_equals', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' }, { value: 'lt', label: 'is less than' },
  { value: 'gte', label: 'is ≥' }, { value: 'lte', label: 'is ≤' },
  { value: 'is_blank', label: 'is blank' }, { value: 'is_not_blank', label: 'is not blank' },
];
const DATE_OPS = [
  { value: 'is', label: 'is' }, { value: 'date_before', label: 'is before' },
  { value: 'date_after', label: 'is after' },
  { value: 'last_n_days', label: 'is in last N days' }, { value: 'next_n_days', label: 'is in next N days' },
  { value: 'is_blank', label: 'is blank' }, { value: 'is_not_blank', label: 'is not blank' },
];
const DROPDOWN_OPS = [
  { value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' },
  { value: 'is_one_of', label: 'is one of' }, { value: 'is_blank', label: 'is blank' },
];
const BOOL_OPS = [
  { value: 'is_true', label: 'is true' }, { value: 'is_false', label: 'is false' },
];

function getOps(type) {
  switch (type) {
    case 'currency': case 'number': case 'percent': return NUMBER_OPS;
    case 'date': return DATE_OPS;
    case 'dropdown': return DROPDOWN_OPS;
    case 'boolean': return BOOL_OPS;
    default: return TEXT_OPS;
  }
}

const noValueOps = new Set(['is_blank', 'is_not_blank', 'is_true', 'is_false']);

export default function FiltersStep({ sourceKey, filters, onChange, filterLogic, onLogicChange }) {
  const groups = getFieldsForSource(sourceKey);
  const allFields = groups.flatMap(g => g.fields);

  const addFilter = () => {
    const first = allFields[0];
    onChange([...filters, { field: first?.key || '', operator: 'is', value: '' }]);
  };

  const updateFilter = (idx, patch) => {
    onChange(filters.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeFilter = (idx) => {
    onChange(filters.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {filters.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          No filters — all records will be returned.
        </p>
      )}
      {filters.map((filter, idx) => {
        const fieldDef = allFields.find(f => f.key === filter.field);
        const ops = getOps(fieldDef?.type || 'text');
        const showValue = !noValueOps.has(filter.operator);

        return (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            {idx > 0 && (
              <button
                onClick={() => onLogicChange(filterLogic === 'AND' ? 'OR' : 'AND')}
                className="text-xs font-bold text-primary w-10 text-center border border-primary/30 rounded px-1 py-0.5 hover:bg-primary/5"
              >
                {filterLogic}
              </button>
            )}
            {idx === 0 && <span className="text-xs text-muted-foreground w-10 text-center">WHERE</span>}

            {/* Field */}
            <Select value={filter.field} onValueChange={v => updateFilter(idx, { field: v, operator: 'is', value: '' })}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <div key={g.group}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">{g.group}</div>
                    {g.fields.map(f => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>

            {/* Operator */}
            <Select value={filter.operator} onValueChange={v => updateFilter(idx, { operator: v })}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ops.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Value */}
            {showValue && (
              fieldDef?.type === 'dropdown' && fieldDef.options ? (
                <Select value={filter.value} onValueChange={v => updateFilter(idx, { value: v })}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldDef.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : fieldDef?.type === 'date' ? (
                <Input type="date" value={filter.value} onChange={e => updateFilter(idx, { value: e.target.value })} className="h-8 text-xs w-36" />
              ) : (
                <Input
                  value={filter.value}
                  onChange={e => updateFilter(idx, { value: e.target.value })}
                  placeholder="Value…"
                  className="h-8 text-xs w-32"
                  type={['currency','number','percent','last_n_days','next_n_days'].includes(fieldDef?.type || filter.operator) ? 'number' : 'text'}
                />
              )
            )}

            <button onClick={() => removeFilter(idx)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <button onClick={addFilter} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
        <Plus className="h-3.5 w-3.5" /> Add Filter
      </button>

      {filters.length > 1 && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Match logic:</span>
          <button
            onClick={() => onLogicChange('AND')}
            className={`text-xs px-2 py-1 rounded border transition ${filterLogic === 'AND' ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}
          >AND (all conditions)</button>
          <button
            onClick={() => onLogicChange('OR')}
            className={`text-xs px-2 py-1 rounded border transition ${filterLogic === 'OR' ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'}`}
          >OR (any condition)</button>
        </div>
      )}
    </div>
  );
}