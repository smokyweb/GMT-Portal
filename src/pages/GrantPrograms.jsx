import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Eye, Wand2, Loader2, Link, Pencil, Trash2 } from 'lucide-react';
import GrantProgramDetail from '../components/GrantProgramDetail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRESET_CODES = ['SHSP', 'UASI', 'EMPG', 'HSGP', 'NSGP', 'SLCGP', 'BRIC'];
const FUNDING_CYCLES = ['Annual', 'Biennial', 'Multi-year'];
const REPORTING_FREQUENCIES = ['Quarterly', 'Biannual', 'Annual'];

export default function GrantPrograms() {
  const [programs, setPrograms] = useState([]);
  const [activeTab, setActiveTab] = useState('programs');
  const [open, setOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [form, setForm] = useState({ name: '', code: 'SHSP', description: '', federal_agency: '', cfda_number: '', is_active: true, reporting_frequency: '' });
  const [formExtra, setFormExtra] = useState({ type: '', fundingCycle: '' });
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false); // custom codes disabled but setter needed
  const [codeError, setCodeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');

  useEffect(() => {
    base44.entities.GrantProgram.filter({ is_active: true }).then((p) => {setPrograms(p);setLoading(false);}).catch(() => base44.entities.GrantProgram.list().then((p) => {setPrograms(p.filter(x => x.is_active !== false));setLoading(false);}));
  }, []);

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('Program Name is required.'); return; }
    const finalCode = useCustomCode ? customCode.trim().toUpperCase() : form.code;
    if (!finalCode) { setCodeError('Code is required.'); return; }
    setCodeError('');

    if (editingProgram) {
      const cleanedFormU = { ...form, code: finalCode,
        match_requirement: form.match_requirement !== '' && form.match_requirement != null ? Number(form.match_requirement) : null,
        award_ceiling: form.award_ceiling !== '' && form.award_ceiling != null ? Number(form.award_ceiling) : null,
        award_floor: form.award_floor !== '' && form.award_floor != null ? Number(form.award_floor) : null,
        reporting_requirements: Array.isArray(form.reporting_requirements) ? form.reporting_requirements : [],
        eligible_applicants: Array.isArray(form.eligible_applicants) ? form.eligible_applicants : [],
      };
      await base44.entities.GrantProgram.update(editingProgram.id, cleanedFormU);
    } else {
      // Build payload - omit any empty string fields entirely to avoid DB type errors
      const cleanedForm = { name: form.name, code: finalCode, is_active: form.is_active !== false };
      if (form.description) cleanedForm.description = form.description;
      if (form.federal_agency) cleanedForm.federal_agency = form.federal_agency;
      if (form.cfda_number) cleanedForm.cfda_number = form.cfda_number;
      if (form.program_type) cleanedForm.program_type = form.program_type;
      if (form.program_year) cleanedForm.program_year = form.program_year;
      if (form.match_requirement !== '' && form.match_requirement != null) cleanedForm.match_requirement = Number(form.match_requirement);
      if (form.award_ceiling !== '' && form.award_ceiling != null) cleanedForm.award_ceiling = Number(form.award_ceiling);
      if (form.award_floor !== '' && form.award_floor != null) cleanedForm.award_floor = Number(form.award_floor);
      if (form.reporting_frequency) cleanedForm.reporting_frequency = form.reporting_frequency;
      if (form.eligibility_criteria) cleanedForm.eligibility_criteria = form.eligibility_criteria;
      if (form.allowable_costs) cleanedForm.allowable_costs = form.allowable_costs;
      try { await base44.entities.GrantProgram.create(cleanedForm); }
      catch (err) { alert('Failed: ' + (err?.message || err?.detail || 'Try again')); return; }
    }

    setOpen(false);
    setEditingProgram(null);
    setForm({ name: '', code: 'SHSP', description: '', federal_agency: '', cfda_number: '', is_active: true, reporting_frequency: '' });
    setFormExtra({ type: '', fundingCycle: '' });
    setCustomCode('');
    setUseCustomCode(false);
    const p = await base44.entities.GrantProgram.list();
    setPrograms(p.filter(x => x.is_active !== false));
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {setScrapeError('Please enter a URL.');return;}
    setScraping(true);
    setScrapeError('');
    const res = await base44.functions.invoke('scrapeGrantRequirements', { url: scrapeUrl.trim() });
    const data = res.data;
    if (data.error) {
      setScrapeError(data.error);
    } else {
      const code = data.program_code?.toUpperCase() || '';
      const isPreset = PRESET_CODES.includes(code);
      setForm((f) => ({
        ...f,
        name: data.program_name || f.name,
        description: data.description ?
        data.eligibility_summary ? `${data.description}\n\nEligibility: ${data.eligibility_summary}` : data.description :
        f.description,
        federal_agency: data.federal_agency || f.federal_agency,
        cfda_number: data.cfda_number || f.cfda_number,
        code: isPreset ? code : f.code
      }));
      if (code && !isPreset) {
        setUseCustomCode(true);
        setCustomCode(code);
      }
    }
    setScraping(false);
  };

  const toggleActive = async (prog) => {
    await base44.entities.GrantProgram.update(prog.id, { is_active: !prog.is_active });
    setPrograms((prev) => prev.map((p) => p.id === prog.id ? { ...p, is_active: !p.is_active } : p));
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    setForm({
      name: program.name,
      code: program.code || 'SHSP',
      description: program.description || '',
      federal_agency: program.federal_agency || '',
      cfda_number: program.cfda_number || '',
      is_active: program.is_active !== false,
      reporting_frequency: program.reporting_frequency || ''
    });
    setFormExtra({ type: program.code || '', fundingCycle: 'Annual' });
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this program? It will be marked inactive and hidden from all lists.')) {
      try {
        await base44.entities.GrantProgram.delete(id);
      } catch (e) {
        // Fallback: mark inactive if delete fails (FK constraint)
        await base44.entities.GrantProgram.update(id, { is_active: false });
      }
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const openNewForm = () => {
    console.log("[GMT] openNewForm called");
    setEditingProgram(null);
    setForm({ name: '', code: 'SHSP', description: '', federal_agency: '', cfda_number: '', is_active: true, reporting_frequency: '' });
    setFormExtra({ type: '', fundingCycle: '' });
    setCustomCode('');
    setUseCustomCode(false);
    setScrapeUrl('');
    setScrapeError('');
    setOpen(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grant Programs</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure and manage grant programs, funding cycles, and requirements.</p>
        </div>
        <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-1" /> Add Program</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="configure">Configure</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {programs.map((p) =>
            <div key={p.id} className="bg-card rounded-xl border p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{p.code}</span>
                    <h3 className="font-semibold mt-2">{p.name}</h3>
                  </div>
                  <Switch checked={p.is_active !== false} onCheckedChange={() => toggleActive(p)} />
                </div>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                <div className="text-xs text-muted-foreground space-y-1">
                  {p.federal_agency && <p>Agency: {p.federal_agency}</p>}
                  {p.cfda_number && <p>CFDA: {p.cfda_number}</p>}
                  {p.reporting_frequency && <p className="text-primary font-medium">Reports: {p.reporting_frequency}</p>}
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
            )}
          </div>
        </TabsContent>

        <TabsContent value="configure" className="space-y-4">
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium">Program Name</th>
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Agency</th>
                    <th className="text-left p-3 font-medium">CFDA</th>
                    <th className="text-left p-3 font-medium">Reporting Frequency</th>
                    <th className="p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((program) =>
                  <tr key={program.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{program.name}</td>
                      <td className="p-3 font-mono text-xs bg-primary/5 rounded">{program.code}</td>
                      <td className="p-3 text-xs">{program.federal_agency || '-'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{program.cfda_number || '-'}</td>
                      <td className="p-3 text-xs font-medium">{program.reporting_frequency || '-'}</td>
                      <td className="p-3 flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { handleEdit(program); }}><Pencil className="h-3 w-3" /> Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => setViewing(program)}>Requirements</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(program.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </td>
                    </tr>
                  )}
                  {programs.length === 0 &&
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No programs configured. Create one to get started.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <GrantProgramDetail
        program={viewing}
        onClose={() => setViewing(null)}
        isAdmin={false}
        onSaved={() => base44.entities.GrantProgram.list().then(setPrograms)} />
      

      <Dialog open={open} onOpenChange={(v) => {setOpen(v);if (!v) {setScrapeUrl('');setScrapeError('');}}}>
         <DialogContent className="max-w-lg">
           <DialogHeader><DialogTitle>{editingProgram ? 'Edit Grant Program' : 'Add Grant Program'}</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* AI Scrape Section removed - not available in self-hosted mode */}

            <div><Label>Program Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Code</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => {setUseCustomCode((v) => !v);setCodeError('');}}>
                  
                  {useCustomCode ? 'Use existing code' : 'Add new code'}
                </button>
              </div>
              {useCustomCode ?
              <Input
                value={customCode}
                onChange={(e) => {setCustomCode(e.target.value);setCodeError('');}}
                placeholder="Enter new code (e.g. MYPRG)"
                className={codeError ? 'border-red-400' : ''} /> :


              <Select value={form.code} onValueChange={(v) => {setForm((f) => ({ ...f, code: v }));setCodeError('');}}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_CODES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              }
              {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
            </div>
            <div>
              <Label>Funding Cycle</Label>
              <Select value={formExtra.fundingCycle} onValueChange={(v) => setFormExtra((f) => ({ ...f, fundingCycle: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNDING_CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reporting Frequency</Label>
              <Select value={form.reporting_frequency} onValueChange={(v) => setForm((f) => ({ ...f, reporting_frequency: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reporting frequency" /></SelectTrigger>
                <SelectContent>
                  {REPORTING_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Federal Agency</Label><Input value={form.federal_agency} onChange={(e) => setForm((f) => ({ ...f, federal_agency: e.target.value }))} /></div>
            <div><Label>CFDA Number</Label><Input value={form.cfda_number} onChange={(e) => setForm((f) => ({ ...f, cfda_number: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingProgram ? 'Update Program' : 'Create Program'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}