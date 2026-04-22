import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, MoreHorizontal, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';

const emptyNofo = {
  title: '', summary: '', program_id: '', program_name: '', program_code: '',
  eligibility_criteria: '', allowable_costs: '', evaluation_criteria: '',
  total_funding_available: 0, min_award: 0, max_award: 0,
  open_date: '', close_date: '', status: 'Draft', required_documents: [],
};

export default function NofoManagement() {
  const [nofos, setNofos] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyNofo);
  const [editing, setEditing] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [n, p, u] = await Promise.all([
      base44.entities.Nofo.list('-created_date', 50),
      base44.entities.GrantProgram.filter({ is_active: true }),
      base44.auth.me(),
    ]);
    setNofos(n);
    setPrograms(p);
    setUser(u);
    setLoading(false);
  };

  const openCreate = () => {
    setForm(emptyNofo);
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (nofo) => {
    setForm({ ...nofo });
    setEditing(nofo);
    setOpen(true);
  };

  const handleSave = async () => {
    const prog = programs.find(p => p.id === form.program_id);
    const data = {
      ...form,
      program_name: prog?.name || form.program_name,
      program_code: prog?.code || form.program_code,
      total_funding_available: Number(form.total_funding_available) || 0,
      min_award: Number(form.min_award) || 0,
      max_award: Number(form.max_award) || 0,
    };

    if (editing) {
      await base44.entities.Nofo.update(editing.id, data);
      await logAudit(base44, user, 'Updated', 'Nofo', editing.id, `Updated NOFO: ${data.title}`);
    } else {
      const created = await base44.entities.Nofo.create(data);
      await logAudit(base44, user, 'Created', 'Nofo', created.id, `Created NOFO: ${data.title}`);
    }
    setOpen(false);
    loadData();
  };

  const changeStatus = async (nofo, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'Published') {
      updates.published_at = new Date().toISOString();
      // Notify all subrecipient users
      const users = await base44.entities.User.list();
      const subs = users.filter(u => u.role === 'user');
      for (const sub of subs) {
        await createNotification(base44, sub.email,
          'New NOFO Published',
          `${nofo.title} is now open for applications.`,
          'nofo_published', 'Nofo', nofo.id, '/browse-nofos'
        );
      }
    }
    await base44.entities.Nofo.update(nofo.id, updates);
    await logAudit(base44, user, `Status changed to ${newStatus}`, 'Nofo', nofo.id, `${nofo.title} → ${newStatus}`);
    loadData();
  };

  const addDoc = () => {
    setForm(f => ({ ...f, required_documents: [...(f.required_documents || []), { name: '', mandatory: true }] }));
  };

  const updateDoc = (idx, field, val) => {
    setForm(f => {
      const docs = [...(f.required_documents || [])];
      docs[idx] = { ...docs[idx], [field]: val };
      return { ...f, required_documents: docs };
    });
  };

  const removeDoc = (idx) => {
    setForm(f => ({ ...f, required_documents: (f.required_documents || []).filter((_, i) => i !== idx) }));
  };

  const getStatusActions = (nofo) => {
    const actions = [];
    switch (nofo.status) {
      case 'Draft': actions.push({ label: 'Submit for Review', status: 'UnderReview' }); break;
      case 'UnderReview':
        actions.push({ label: 'Approve & Publish', status: 'Published' });
        actions.push({ label: 'Request Changes', status: 'Draft' });
        break;
      case 'Published': actions.push({ label: 'Close', status: 'Closed' }); break;
      case 'Closed': actions.push({ label: 'Archive', status: 'Archived' }); break;
    }
    return actions;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NOFO Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage Notices of Funding Opportunity</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create NOFO</Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Funding</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Window</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {nofos.map(nofo => (
                <tr key={nofo.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{nofo.title}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      {nofo.program_code || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(nofo.total_funding_available)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatDateShort(nofo.open_date)} – {formatDateShort(nofo.close_date)}
                  </td>
                  <td className="p-3"><StatusBadge status={nofo.status} /></td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(nofo)}>Edit</DropdownMenuItem>
                        {getStatusActions(nofo).map(a => (
                          <DropdownMenuItem key={a.status} onClick={() => changeStatus(nofo, a.status)}>
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {nofos.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No NOFOs created yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit NOFO' : 'Create NOFO'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="FY2025 SHSP NOFO" />
            </div>
            <div>
              <Label>Grant Program</Label>
              <Select value={form.program_id} onValueChange={v => setForm(f => ({ ...f, program_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summary</Label>
              <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Total Funding ($)</Label>
                <Input type="number" value={form.total_funding_available} onChange={e => setForm(f => ({ ...f, total_funding_available: e.target.value }))} />
              </div>
              <div>
                <Label>Min Award ($)</Label>
                <Input type="number" value={form.min_award} onChange={e => setForm(f => ({ ...f, min_award: e.target.value }))} />
              </div>
              <div>
                <Label>Max Award ($)</Label>
                <Input type="number" value={form.max_award} onChange={e => setForm(f => ({ ...f, max_award: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Open Date</Label>
                <Input type="date" value={form.open_date} onChange={e => setForm(f => ({ ...f, open_date: e.target.value }))} />
              </div>
              <div>
                <Label>Close Date</Label>
                <Input type="date" value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Eligibility Criteria</Label>
              <Textarea value={form.eligibility_criteria} onChange={e => setForm(f => ({ ...f, eligibility_criteria: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Allowable Costs</Label>
              <Textarea value={form.allowable_costs} onChange={e => setForm(f => ({ ...f, allowable_costs: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Evaluation Criteria</Label>
              <Textarea value={form.evaluation_criteria} onChange={e => setForm(f => ({ ...f, evaluation_criteria: e.target.value }))} rows={2} />
            </div>

            {/* Required Documents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Required Documents</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDoc}>+ Add Document</Button>
              </div>
              <div className="space-y-2">
                {(form.required_documents || []).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={doc.name} onChange={e => updateDoc(idx, 'name', e.target.value)} placeholder="Document name" className="flex-1" />
                    <div className="flex items-center gap-1">
                      <Checkbox checked={doc.mandatory} onCheckedChange={v => updateDoc(idx, 'mandatory', v)} />
                      <span className="text-xs">Required</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeDoc(idx)}>✕</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'} NOFO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}