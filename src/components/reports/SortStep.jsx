import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SortStep({ selectedFields, sortRules, onChange }) {
  const addRule = () => {
    if (sortRules.length >= 3) return;
    const first = selectedFields[0];
    onChange([...sortRules, { field: first?.key || '', direction: 'asc' }]);
  };

  const updateRule = (idx, patch) => {
    onChange(sortRules.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const removeRule = (idx) => {
    onChange(sortRules.filter((_, i) => i !== idx));
  };

  if (selectedFields.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Select fields in Step 2 first.</p>;
  }

  return (
    <div className="space-y-3">
      {sortRules.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          No sort rules — results will appear in default order.
        </p>
      )}

      {sortRules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 flex-shrink-0">
            {idx === 0 ? 'Sort by' : 'Then by'}
          </span>

          <Select value={rule.field} onValueChange={v => updateRule(idx, { field: v })}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectedFields.map(f => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded overflow-hidden">
            <button
              onClick={() => updateRule(idx, { direction: 'asc' })}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition
                ${rule.direction === 'asc' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
            >
              <ArrowUp className="h-3 w-3" /> Asc
            </button>
            <button
              onClick={() => updateRule(idx, { direction: 'desc' })}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition
                ${rule.direction === 'desc' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
            >
              <ArrowDown className="h-3 w-3" /> Desc
            </button>
          </div>

          <button onClick={() => removeRule(idx)}>
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      ))}

      {sortRules.length < 3 && (
        <button onClick={addRule} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add Sort Rule
        </button>
      )}
    </div>
  );
}