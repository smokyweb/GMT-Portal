import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, MoreHorizontal, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '../components/StatusBadge';
import RequiredTemplatesPanel from '@/components/RequiredTemplatesPanel';
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';

const ORG_TYPES = ['County', 'Municipality', 'Nonprofit', 'Tribe'];

const emptyNofo = {
  title: '', grant_number: '', summary: '', program_id: '', program_name: '', program_code: '',
  eligibility_criteria: '', allowable_costs: '', evaluation_criteria: '',
  total_funding_available: 0, min_award: 0, max_award: 0,
  open_date: '', close_date: '', status: 'Draft', required_documents: [],
  eligible_org_types: [], scoring_enabled: false, scope_states: [],
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
    setUser(u);
    setPrograms(p);

    // Filter NOFOs by user role
    let filtered = n;
    if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
      if (u.role === 'admin' && u.scope_state) {
        // State admin: see NOFOs where scope_states includes their state OR scope_states is empty (universal)
        filtered = n.filter(nofo => 
          !nofo.scope_states || nofo.scope_states.length === 0 || nofo.scope_states.includes(u.scope_state)
        );
      }
    }
    setNofos(filtered);
    setLoading(false);
  };

  const openCreate = () => {
    setForm(emptyNofo);
    setEditing(null);
    setOpen(true);
  };

  // Format ISO date strings to YYYY-MM-DD for date inputs
  const toDateInput = (val) => {
    if (!val) return '';
    if (typeof val === 'string' && val.length >= 10) return val.substring(0, 10);
    return '';
  };

  const openEdit = (nofo) => {
    setForm({
      ...nofo,
      open_date: toDateInput(nofo.open_date),
      close_date: toDateInput(nofo.close_date),
      eligible_org_types: nofo.eligible_org_types || [],
    });
    setEditing(nofo);
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!form.title?.trim()) {
      setSaveError('Title is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const prog = programs.find(p => p.id === form.program_id);
      let data = {
        ...form,
        program_name: prog?.name || form.program_name,
        program_code: prog?.code || form.program_code,
        total_funding_available: Number(form.total_funding_available) || 0,
        min_award: Number(form.min_award) || 0,
        max_award: Number(form.max_award) || 0,
        eligible_org_types: form.eligible_org_types || [],
      };

      // Auto-set scope_states for state admins creating NOFOs
      if (!editing && user && user.role === 'admin' && user.scope_state && (!form.scope_states || form.scope_states.length === 0)) {
        data.scope_states = [user.scope_state];
      }

      // Strip server-managed fields before saving
      const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, created_by_id: _cbid,
        is_sample: _is, published_at: _pa, reviewed_by: _rb, ...cleanData } = data;

      if (editing) {
        await base44.entities.Nofo.update(editing.id, cleanData);
        await logAudit(base44, user, 'Updated', 'Nofo', editing.id, `Updated NOFO: ${cleanData.title}`);
      } else {
        const created = await base44.entities.Nofo.create(cleanData);
        await logAudit(base44, user, 'Created', 'Nofo', created.id, `Created NOFO: ${cleanData.title}`);
      }
      setOpen(false);
      loadData();
    } catch (err) {
      console.error('NOFO save error:', err);
      setSaveError('Failed to save NOFO: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
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
        actions.push({ label: 'Request Changes', status: 'RevisionRequested' });
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
                <th className="text-left p-3 font-medium text-muted-foreground">Grant #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Funding</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Window</th>
                <th className="text-left p-3 font-medium text-muted-foreground">States</th>
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
                  <td className="p-3 text-xs font-mono text-muted-foreground">{nofo.grant_number || ' - '}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      {nofo.program_code || ' - '}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium">{formatCurrency(nofo.total_funding_available)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatDateShort(nofo.open_date)} - {formatDateShort(nofo.close_date)}
                  </td>
                  <td className="p-3">
                    {(!nofo.scope_states || nofo.scope_states.length === 0) ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium">All States</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {nofo.scope_states.map(state => (
                          <span key={state} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{state}</span>
                        ))}
                      </div>
                    )}
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
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No NOFOs created yet</td></tr>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="FY2025 SHSP NOFO" />
              </div>
              <div>
                <Label>Grant Number</Label>
                <Input value={form.grant_number} onChange={e => setForm(f => ({ ...f, grant_number: e.target.value }))} placeholder="e.g. EMS-2025-SS-00001" />
              </div>
            </div>
            <div>
              <Label>Grant Program</Label>
              <Select
                value={form.program_id}
                onValueChange={v => {
                  const prog = programs.find(p => p.id === v);
                  setForm(f => ({
                    ...f,
                    program_id: v,
                    program_name: prog?.name || f.program_name,
                    program_code: prog?.code || f.program_code,
                    // Prefill eligibility from program - use eligibility_criteria field
                    eligibility_criteria: f.eligibility_criteria || prog?.eligibility_criteria || (Array.isArray(prog?.eligibility_requirements) ? prog.eligibility_requirements.join('\n') : '') || '',
                    allowable_costs: f.allowable_costs || prog?.allowable_costs || '',
                  }));
                }}
              >
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
            {form.program_id && (
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Eligibility and Allowable Costs below are pre-filled from the selected program's defaults. You can refine them for this specific NOFO.</span>
              </div>
            )}
            <div>
              <Label>Eligibility Criteria</Label>
              <Textarea value={form.eligibility_criteria} onChange={e => setForm(f => ({ ...f, eligibility_criteria: e.target.value }))} rows={3} placeholder="Pre-filled from program when a program is selected..." />
            </div>
            <div>
              <Label>Allowable Costs</Label>
              <Textarea value={form.allowable_costs} onChange={e => setForm(f => ({ ...f, allowable_costs: e.target.value }))} rows={3} placeholder="Pre-filled from program when a program is selected..." />
            </div>
            <div>
              <Label>Evaluation Criteria</Label>
              <Textarea value={form.evaluation_criteria} onChange={e => setForm(f => ({ ...f, evaluation_criteria: e.target.value }))} rows={2} />
            </div>

            {/* State Scope */}
            <div>
              <Label>Available States</Label>
              <p className="text-xs text-muted-foreground mb-2">Leave empty to make this NOFO available to all states.</p>
              <Input
                value={(form.scope_states || []).join(', ')}
                onChange={e => setForm(f => ({ ...f, scope_states: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) }))}
                placeholder="e.g. NE, IL, CA"
              />
            </div>

            {/* Eligibility Restrictions */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div>
                <Label className="font-semibold">Eligible Organization Types</Label>
                <p className="text-xs text-muted-foreground mb-2">Leave all unchecked to allow all organization types.</p>
                <div className="flex flex-wrap gap-3">
                  {ORG_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={(form.eligible_org_types || []).includes(type)}
                        onCheckedChange={checked => {
                          setForm(f => {
                            const current = f.eligible_org_types || [];
                            return {
                              ...f,
                              eligible_org_types: checked
                                ? [...current, type]
                                : current.filter(t => t !== type),
                            };
                          });
                        }}
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Scoring */}
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div>
                <Label className="font-semibold">Enable Application Scoring</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow reviewers to score applications submitted under this NOFO using the rubric scorecard.</p>
              </div>
              <Switch
                checked={!!form.scoring_enabled}
                onCheckedChange={v => setForm(f => ({ ...f, scoring_enabled: v }))}
              />
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

            {/* Required Document Templates */}
            {editing && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <RequiredTemplatesPanel
                  entityType="NOFO"
                  entityId={editing.id}
                  requiredTemplateIds={form.required_template_ids || []}
                  onUpdate={(ids) => setForm(f => ({ ...f, required_template_ids: ids }))}
                  isAdmin={true}
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col items-end gap-2">
            {saveError && <p className="text-sm text-red-500 w-full">{saveError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); setSaveError(''); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Update' : 'Create')} NOFO</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}