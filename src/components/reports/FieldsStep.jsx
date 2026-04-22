import { useState } from 'react';
import { X, GripVertical, Pencil, Check } from 'lucide-react';
import { getFieldsForSource } from '../../lib/reportDataSources';
import { Input } from '@/components/ui/input';

export default function FieldsStep({ sourceKey, selectedFields, onChange }) {
  const [search, setSearch] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const groups = getFieldsForSource(sourceKey);
  const allAvailable = groups.flatMap(g => g.fields);
  const selectedKeys = new Set(selectedFields.map(f => f.key));

  const filteredGroups = groups.map(g => ({
    ...g,
    fields: g.fields.filter(f =>
      !selectedKeys.has(f.key) &&
      f.label.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.fields.length > 0);

  const addField = (field) => {
    onChange([...selectedFields, { key: field.key, label: field.label }]);
  };

  const removeField = (key) => {
    onChange(selectedFields.filter(f => f.key !== key));
  };

  const addAll = () => {
    const toAdd = allAvailable.filter(f => !selectedKeys.has(f.key));
    onChange([...selectedFields, ...toAdd.map(f => ({ key: f.key, label: f.label }))]);
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditLabel(selectedFields[idx].label);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const updated = selectedFields.map((f, i) => i === editingIdx ? { ...f, label: editLabel } : f);
    onChange(updated);
    setEditingIdx(null);
  };

  // Drag-to-reorder
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...selectedFields];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onChange(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="grid grid-cols-2 gap-4 min-h-[300px]">
      {/* Available Fields */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">AVAILABLE FIELDS</p>
          <button onClick={addAll} className="text-xs text-primary hover:underline">Select All</button>
        </div>
        <Input
          placeholder="Search fields…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="border rounded-lg overflow-y-auto max-h-64 bg-muted/20">
          {filteredGroups.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {selectedKeys.size >= allAvailable.length ? 'All fields selected' : 'No matching fields'}
            </p>
          )}
          {filteredGroups.map(g => (
            <div key={g.group}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">{g.group}</p>
              {g.fields.map(f => (
                <button
                  key={f.key}
                  onClick={() => addField(f)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 hover:text-primary transition flex items-center gap-1.5"
                >
                  {f.label.startsWith('ƒ') && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded font-mono">ƒ</span>
                  )}
                  {f.label.startsWith('ƒ') ? f.label.slice(2) : f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Fields */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground">SELECTED FIELDS ({selectedFields.length})</p>
        <div className="border rounded-lg overflow-y-auto max-h-[300px] bg-card">
          {selectedFields.length === 0 && (
            <p className="text-xs text-muted-foreground p-4 text-center">Click fields on the left to add them →</p>
          )}
          {selectedFields.map((f, idx) => (
            <div
              key={f.key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              className={`flex items-center gap-2 px-2 py-1.5 border-b last:border-0 transition
                ${dragOverIdx === idx ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab flex-shrink-0" />
              {editingIdx === idx ? (
                <>
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && commitEdit()}
                    className="flex-1 text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={commitEdit}><Check className="h-3 w-3 text-green-600" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs truncate">{f.label}</span>
                  <button onClick={() => startEdit(idx)} className="opacity-0 group-hover:opacity-100 hover:opacity-100">
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </button>
                </>
              )}
              <button onClick={() => removeField(f.key)}><X className="h-3 w-3 text-muted-foreground hover:text-red-500" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}