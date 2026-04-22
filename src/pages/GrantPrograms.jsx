import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Eye } from 'lucide-react';
import GrantProgramDetail from '../components/GrantProgramDetail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const PRESET_CODES = ['SHSP', 'UASI', 'EMPG', 'HSGP', 'NSGP', 'EOC', 'SLCGP', 'Other'];

export default function GrantPrograms() {
  const [programs, setPrograms] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: 'SHSP', description: '', federal_agency: '', cfda_number: '', is_active: true });
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    base44.entities.GrantProgram.list().then(p => { setPrograms(p); setLoading(false); });
  }, []);

  const handleSave = async () => {
    const finalCode = useCustomCode ? customCode.trim().toUpperCase() : form.code;
    if (!finalCode) { setCodeError('Code is required.'); return; }
    const duplicate = programs.some(p => p.code?.toUpperCase() === finalCode);
    if (duplicate) { setCodeError(`Code "${finalCode}" already exists.`); return; }
    setCodeError('');
    await base44.entities.GrantProgram.create({ ...form, code: finalCode });
    setOpen(false);
    setForm({ name: '', code: 'SHSP', description: '', federal_agency: '', cfda_number: '', is_active: true });
    setCustomCode('');
    setUseCustomCode(false);
    const p = await base44.entities.GrantProgram.list();
    setPrograms(p);
  };

  const toggleActive = async (prog) => {
    await base44.entities.GrantProgram.update(prog.id, { is_active: !prog.is_active });
    setPrograms(prev => prev.map(p => p.id === prog.id ? { ...p, is_active: !p.is_active } : p));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grant Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage grant program types</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Program</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {programs.map(p => (
          <div key={p.id} className="bg-card rounded-xl border p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{p.code}</span>
                <h3 className="font-semibold mt-2">{p.name}</h3>
              </div>
              <Switch checked={p.is_active !== false} onCheckedChange={() => toggleActive(p)} />
            </div>
            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            <div className="text-xs text-muted-foreground">
              {p.federal_agency && <p>Agency: {p.federal_agency}</p>}
              {p.cfda_number && <p>CFDA: {p.cfda_number}</p>}
            </div>
            <div className="flex items-center justify-between">
              <div className={`text-xs font-medium ${p.is_active !== false ? 'text-green-600' : 'text-red-600'}`}>
                {p.is_active !== false ? '● Active' : '● Inactive'}
              </div>
              <Button variant="outline" size="sm" onClick={() => setViewing(p)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> View Requirements
              </Button>
            </div>
          </div>
        ))}
      </div>

      <GrantProgramDetail program={viewing} onClose={() => setViewing(null)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Grant Program</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Program Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Code</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => { setUseCustomCode(v => !v); setCodeError(''); }}
                >
                  {useCustomCode ? 'Use existing code' : 'Add new code'}
                </button>
              </div>
              {useCustomCode ? (
                <Input
                  value={customCode}
                  onChange={e => { setCustomCode(e.target.value); setCodeError(''); }}
                  placeholder="Enter new code (e.g. MYPRG)"
                  className={codeError ? 'border-red-400' : ''}
                />
              ) : (
                <Select value={form.code} onValueChange={v => { setForm(f => ({ ...f, code: v })); setCodeError(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Federal Agency</Label><Input value={form.federal_agency} onChange={e => setForm(f => ({ ...f, federal_agency: e.target.value }))} /></div>
            <div><Label>CFDA Number</Label><Input value={form.cfda_number} onChange={e => setForm(f => ({ ...f, cfda_number: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Create Program</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}