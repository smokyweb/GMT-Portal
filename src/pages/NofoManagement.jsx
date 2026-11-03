import NofoDetailsSections from '@/components/nofo-form/NofoDetailsSections';
import {prepareNofoAwardForm,nofoAwardSaveData} from '@/lib/awards/nofoAwardData';
import NofoEditContent from '@/components/nofo-form/NofoEditContent';
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, MoreHorizontal, FileText, Info, Search } from 'lucide-react';
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
import { formatCurrency, formatDateShort, logAudit, createNotification } from '../lib/helpers';
import { toast } from '@/components/ui/toast-simple';

const emptyNofo = {
  title: '', grant_number: '', summary: '', program_id: '', program_name: '', program_code: '',
  eligibility_criteria: '', allowable_costs: '', evaluation_criteria: '',
  total_funding_available: 0, min_award: 0, max_award: 0,
  fiscal_year: '', federal_award_date: '', federal_close_date: '', federal_performance_start: '', federal_performance_end: '', local_share_amount: '', state_share_amount: '', mou_amount: '', local_share_pct: null, state_share_pct: null, legacy_grant_id: '',
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
  const [viewNofo, setViewNofo] = useState(null);
  const [revisionNofo, setRevisionNofo] = useState(null); // NOFO awaiting revision feedback
  const [revisionNotes, setRevisionNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterFiscalYear, setFilterFiscalYear] = useState('');
  const [fiscalYearSort, setFiscalYearSort] = useState('desc');
  const [grantees, setGrantees] = useState([]);
  const [selectedGranteeId, setSelectedGranteeId] = useState('');
  const [legacyConfig, setLegacyConfig] = useState({ enabled: false, systemName: '', canEdit: false });
  const legacyLabel = legacyConfig.systemName ? `${legacyConfig.systemName} Grant ID` : 'Legacy ID';
  const [nofoStats, setNofoStats] = useState({}); // map nofo_id -> { awarded, remaining }
  const [nofoHistory, setNofoHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async (u = user, viewingId = selectedGranteeId) => {
    const [n, p, currentUser, gs] = await Promise.all([
      base44.entities.Nofo.list('-created_date', 500, { grantee_id: viewingId || undefined }),
      base44.entities.GrantProgram.list('-name', 100),
      u ? Promise.resolve(u) : base44.auth.me(),
      base44.entities.Grantee.list('-created_date', 200),
    ]);
    const activeUser = currentUser || u;
    const allGrantees = gs || [];
    const id = viewingId || (activeUser?.role === 'isc_admin'
      ? (allGrantees[0]?.id || '')
      : (allGrantees.find(g => g.id === activeUser?.grantee_id || g.state_code === activeUser?.scope_state)?.id || ''));
    const grantee = allGrantees.find(g => g.id === id);
    setUser(activeUser);
    setPrograms(p || []);
    setGrantees(allGrantees);
    setSelectedGranteeId(id);
    setLegacyConfig({ enabled: Boolean(grantee?.legacy_fields_enabled), systemName: grantee?.legacy_system_name?.trim() || '', canEdit: Boolean(grantee?.legacy_fields_enabled && ['admin', 'isc_admin'].includes(activeUser?.role)) });
    let filtered = n || [];
    if (activeUser && !['isc_admin', 'federal_admin', 'federal_officer'].includes(activeUser.role) && activeUser.role === 'admin' && activeUser.scope_state) {
      filtered = filtered.filter(nofo => !nofo.scope_states || nofo.scope_states.length === 0 || nofo.scope_states.includes(activeUser.scope_state));
    }
    setNofos(filtered);
    base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 500).then(apps => {
      const statsMap = {};
      (apps || []).forEach(app => { if (app.nofo_id) { if (!statsMap[app.nofo_id]) statsMap[app.nofo_id] = { awarded: 0 }; statsMap[app.nofo_id].awarded += Number(app.awarded_amount) || 0; } });
      setNofoStats(statsMap);
    }).catch(() => {});
    setLoading(false);
  };

  const changeViewingGrantee = async (id) => {
    setSelectedGranteeId(id);
    setLoading(true);
    await loadData(user, id);
  };

  const openCreate = () => {
    // Pre-fill scope_states with the state admin's assigned state
    const defaultState = user?.scope_state && ['admin','reviewer'].includes(user?.role) ? [user.scope_state] : [];
    setForm({ ...emptyNofo, scope_states: defaultState });
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
    const prog = programs.find(p => p.id === nofo.program_id);
    setForm({
      ...prepareNofoAwardForm(nofo,prog),
      open_date: toDateInput(nofo.open_date),
      close_date: toDateInput(nofo.close_date),
      eligible_org_types: nofo.eligible_org_types || [],
      scope_states: nofo.scope_states || (user?.scope_state ? [user.scope_state] : []),
      fiscal_year: nofo.fiscal_year ?? '',
      local_share_amount: nofo.local_share_amount ?? '',
      state_share_amount: nofo.state_share_amount ?? '',
      mou_amount: nofo.mou_amount ?? '',
      local_share_pct: nofo.local_share_pct ?? null,
      state_share_pct: nofo.state_share_pct ?? null,
      legacy_grant_id: nofo.legacy_grant_id || '',
      // Prefill eligibility from program if not already set
      eligibility_criteria: nofo.eligibility_criteria || prog?.eligibility_criteria || (Array.isArray(prog?.eligibility_requirements) ? prog.eligibility_requirements.join('\n') : '') || '',
      allowable_costs: nofo.allowable_costs || prog?.allowable_costs || '',
    });
    setEditing(nofo);
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!form.title?.trim()) { setSaveError('Title is required.'); return; }
    if (!editing && (!form.fiscal_year || !/^\d{4}$/.test(String(form.fiscal_year)))) { setSaveError('Fiscal Year is required and must be 4 digits for new NOFOs.'); return; }
    if (form.federal_performance_start && form.federal_performance_end && form.federal_performance_end < form.federal_performance_start) { setSaveError('Federal PoP End must be on or after Federal PoP Start.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const prog = programs.find(p => p.id === form.program_id);
      let data = {
        ...nofoAwardSaveData(form),
        program_name: prog?.name || form.program_name,
        program_code: prog?.code || form.program_code,
        total_funding_available: Number(form.total_funding_available) || 0,
        min_award: Number(form.min_award) || 0,
        max_award: Number(form.max_award) || 0,
        eligible_org_types: form.eligible_org_types || [],
        fiscal_year: form.fiscal_year === '' ? null : Number(form.fiscal_year),
        local_share_amount: form.local_share_amount === '' ? null : Number(form.local_share_amount),
        state_share_amount: form.state_share_amount === '' ? null : Number(form.state_share_amount),
        mou_amount: form.mou_amount === '' ? null : Number(form.mou_amount),
      };
      delete data.local_share_pct;
      delete data.state_share_pct;
      if (!legacyConfig.canEdit) delete data.legacy_grant_id;

      // Auto-set scope_states for state admins creating NOFOs
      if (!editing && user && user.role === 'admin' && user.scope_state && (!form.scope_states || form.scope_states.length === 0)) {
        data.scope_states = [user.scope_state];
      }

      // Strip server-managed fields before saving
      const { id: _id, created_date: _cd, updated_date: _ud, created_by: _cb, created_by_id: _cbid,
        is_sample: _is, published_at: _pa, reviewed_by: _rb, attachments: _att, total_funding: _tf, ...cleanData } = data;
      // Clean required_documents: remove any server-generated id fields from items
      if (cleanData.required_documents) {
        cleanData.required_documents = (cleanData.required_documents || []).map(d => ({
          name: d.name || '',
          mandatory: !!d.mandatory,
          description: d.description || undefined,
        })).filter(d => d.name.trim());
      }

      if (editing) {
        await base44.entities.Nofo.update(editing.id, cleanData);

      } else {
        await base44.entities.Nofo.create(cleanData);

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

  const openView = async (nofo) => {
    setViewNofo(nofo);
    setHistoryLoading(true);
    setNofoHistory([]);
    const logs = await base44.entities.AuditLog.filter({ entity_id: nofo.id }, '-created_date', 50).catch(() => []);
    setNofoHistory(logs || []);
    setHistoryLoading(false);
  };

  const handleRequestChanges = (nofo) => {
    setRevisionNofo(nofo);
    setRevisionNotes('');
    if (viewNofo) setViewNofo(null); // close view dialog
  };

  const submitRevisionRequest = async () => {
    if (!revisionNofo) return;
    const updates = { status: 'RevisionRequested', reviewer_notes: revisionNotes || null };
    await base44.entities.Nofo.update(revisionNofo.id, updates);
    await logAudit(base44, user, 'Revision Requested', 'Nofo', revisionNofo.id,
      `${revisionNofo.title} → Changes Requested: ${revisionNotes || 'No notes provided'}`);
    // Notify NOFO creator
    if (revisionNofo.created_by) {
      await createNotification(base44, revisionNofo.created_by,
        'Changes Requested for NOFO',
        `Your NOFO "${revisionNofo.title}" requires revisions: ${revisionNotes || 'Please see notes.'}`,
        'nofo_revision', 'Nofo', revisionNofo.id, '/nofo-management'
      ).catch(() => {});
    }
    setRevisionNofo(null);
    setRevisionNotes('');
    loadData();
    toast('Changes requested — submitter has been notified.', 'success');
  };

  const changeStatus = async (nofo, newStatus) => {
    if (newStatus === 'RevisionRequested') { handleRequestChanges(nofo); return; }
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
      case 'RevisionRequested':
        actions.push({ label: 'Submit for Re-Review', status: 'UnderReview' });
        actions.push({ label: 'Approve & Publish', status: 'Published' });
        break;
      case 'Published': actions.push({ label: 'Close', status: 'Closed' }); break;
      case 'Closed': actions.push({ label: 'Archive', status: 'Archived' }); break;
    }
    return actions;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const filteredNofos = nofos.filter(n => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterProgram !== 'all' && n.program_code !== filterProgram) return false;
    if (filterFiscalYear && String(n.fiscal_year || '') !== String(filterFiscalYear)) return false;
    if (searchTerm && !n.title?.toLowerCase().includes(searchTerm.toLowerCase()) && !n.program_code?.toLowerCase().includes(searchTerm.toLowerCase()) && !n.grant_number?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  const orderedNofos = [...filteredNofos].sort((a,b) => { const ay = Number(a.fiscal_year || 0), by = Number(b.fiscal_year || 0); return fiscalYearSort === 'asc' ? ay - by : by - ay; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NOFO Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage Notices of Funding Opportunity</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create NOFO</Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search NOFOs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="UnderReview">Under Review</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-[125px]" type="number" min="1000" max="9999" placeholder="Fiscal Year" value={filterFiscalYear} onChange={e => setFilterFiscalYear(e.target.value)} />
        {user?.role === 'isc_admin' && <Select value={selectedGranteeId || '__none__'} onValueChange={v => changeViewingGrantee(v === '__none__' ? '' : v)}><SelectTrigger className="w-[180px]"><SelectValue placeholder="View grantee" /></SelectTrigger><SelectContent><SelectItem value="__none__">No grantee selected</SelectItem>{grantees.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>}
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {[...new Set(nofos.map(n => n.program_code).filter(Boolean))].sort().map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredNofos.length} of {nofos.length}</span>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Grant #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground"><Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => setFiscalYearSort(v => v === 'asc' ? 'desc' : 'asc')}>Fiscal Year {fiscalYearSort === 'asc' ? '↑' : '↓'}</Button></th>
                <th className="text-right p-3 font-medium text-muted-foreground">Available</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Remaining</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Window</th>
                <th className="text-left p-3 font-medium text-muted-foreground">States</th>
                {legacyConfig.enabled && <th className="text-left p-3 font-medium text-muted-foreground">{legacyLabel}</th>}
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orderedNofos.map(nofo => (
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
                  <td className="p-3 text-right font-mono text-xs">{nofo.fiscal_year || ' - '}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(nofo.total_funding_available)}</td>
                  <td className="p-3 text-right font-medium text-green-700">{nofoStats[nofo.id]?.awarded ? formatCurrency(nofoStats[nofo.id].awarded) : <span className="text-muted-foreground text-xs">-</span>}</td>
                  <td className="p-3 text-right text-blue-700 font-medium">{nofoStats[nofo.id]?.awarded && nofo.total_funding_available ? formatCurrency(Math.max(0, Number(nofo.total_funding_available) - nofoStats[nofo.id].awarded)) : <span className="text-muted-foreground text-xs">-</span>}</td>
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
                  {legacyConfig.enabled && <td className="p-3 font-mono text-xs">{nofo.legacy_grant_id || ' - '}</td>}
                  <td className="p-3"><StatusBadge status={nofo.status} /></td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(nofo)}>&#128065; View / Review</DropdownMenuItem>
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
                <tr><td colSpan={legacyConfig.enabled ? 12 : 11} className="p-8 text-center text-muted-foreground">No NOFOs created yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit NOFO' : 'Create NOFO'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <NofoEditContent nofo={editing}>
              <NofoDetailsSections
                form={form}
                onChange={next => setForm(next)}
                programs={programs}
                editing={editing}
                legacyConfig={legacyConfig}
                legacyLabel={legacyLabel}
                onAddDoc={addDoc}
                onUpdateDoc={updateDoc}
                onRemoveDoc={removeDoc}
              />
            </NofoEditContent>
          </div>
          <DialogFooter className="flex-shrink-0 flex-col items-end gap-2 border-t pt-3">
            {saveError && <p className="text-sm text-red-500 w-full">{saveError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); setSaveError(''); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Update' : 'Create')} NOFO</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOFO View / Review Dialog */}
      {viewNofo && (
        <Dialog open={!!viewNofo} onOpenChange={o => { if (!o) setViewNofo(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewNofo.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{viewNofo.program_name} &bull; {viewNofo.program_code} &bull; <span className="font-medium">{viewNofo.status}</span></p>
            </DialogHeader>

            {/* Summary */}
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Fiscal Year</p><p className="font-medium">{viewNofo.fiscal_year || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Funding</p><p className="font-medium">{viewNofo.total_funding_available ? `${Number(viewNofo.total_funding_available).toLocaleString()}` : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Award Range</p><p className="font-medium">{viewNofo.min_award || viewNofo.max_award ? `$${Number(viewNofo.min_award||0).toLocaleString()} - $${Number(viewNofo.max_award||0).toLocaleString()}` : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Open Date</p><p className="font-medium">{viewNofo.open_date ? new Date(viewNofo.open_date).toLocaleDateString('en-US', {timeZone:'UTC', month:'short', day:'numeric', year:'numeric'}) : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Close Date</p><p className="font-medium">{viewNofo.close_date ? new Date(viewNofo.close_date).toLocaleDateString('en-US', {timeZone:'UTC', month:'short', day:'numeric', year:'numeric'}) : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Federal PoP</p><p className="font-medium">{viewNofo.federal_performance_start || viewNofo.federal_performance_end ? `${formatDateShort(viewNofo.federal_performance_start)} - ${formatDateShort(viewNofo.federal_performance_end)}` : '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Local / State Share</p><p className="font-medium">{viewNofo.local_share_pct != null ? `${Number(viewNofo.local_share_pct).toFixed(2)}%` : '-'} / {viewNofo.state_share_pct != null ? `${Number(viewNofo.state_share_pct).toFixed(2)}%` : '-'}</p></div>
                {legacyConfig.enabled && <div><p className="text-xs text-muted-foreground">{legacyLabel}</p><p className="font-medium">{viewNofo.legacy_grant_id || '-'}</p></div>}
                <div><p className="text-xs text-muted-foreground">Available States</p><p className="font-medium">{viewNofo.scope_states?.length ? viewNofo.scope_states.join(', ') : 'All States'}</p></div>
                <div><p className="text-xs text-muted-foreground">Scoring Enabled</p><p className="font-medium">{viewNofo.scoring_enabled ? 'Yes' : 'No'}</p></div>
              </div>

              {viewNofo.summary && <div><p className="text-xs text-muted-foreground font-medium">Summary</p><p className="mt-1 bg-muted/40 rounded-lg p-3">{viewNofo.summary}</p></div>}
              {viewNofo.eligibility_criteria && <div><p className="text-xs text-muted-foreground font-medium">Eligibility Criteria</p><p className="mt-1 bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{viewNofo.eligibility_criteria}</p></div>}
              {viewNofo.allowable_costs && <div><p className="text-xs text-muted-foreground font-medium">Allowable Costs</p><p className="mt-1 bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{viewNofo.allowable_costs}</p></div>}
              {viewNofo.evaluation_criteria && <div><p className="text-xs text-muted-foreground font-medium">Evaluation Criteria</p><p className="mt-1 bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{viewNofo.evaluation_criteria}</p></div>}

              {/* Approval Actions */}
              {getStatusActions(viewNofo).length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                  <p className="text-sm font-semibold">Review Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {getStatusActions(viewNofo).map(a => (
                      <Button key={a.status}
                        variant={a.status === 'Published' ? 'default' : a.status === 'RevisionRequested' ? 'outline' : 'secondary'}
                        className={a.status === 'Published' ? 'bg-green-600 hover:bg-green-700' : ''}
                        onClick={async () => { await changeStatus(viewNofo, a.status); setViewNofo(null); }}
                      >{a.label}</Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Review History */}
              <div className="border rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold">Review History</p>
                {historyLoading ? (
                  <p className="text-xs text-muted-foreground">Loading history...</p>
                ) : nofoHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {nofoHistory.map((log, i) => (
                      <div key={log.id || i} className="flex items-start gap-3 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{log.created_date ? new Date(log.created_date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-'}</span>
                        <span className="font-medium text-muted-foreground">{log.user_email || log.user_name}</span>
                        <span className="flex-1">{log.description || log.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => openEdit(viewNofo)} className="mr-auto">Edit</Button>
              <Button variant="outline" onClick={() => setViewNofo(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Request Changes Modal */}
      {revisionNofo && (
        <Dialog open={true} onOpenChange={() => setRevisionNofo(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Request Changes — {revisionNofo.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Describe the changes needed before this NOFO can be published. The submitter will be notified.</p>
              <div>
                <Label>Revision Notes <span className="text-red-500">*</span></Label>
                <Textarea
                  rows={5}
                  value={revisionNotes}
                  onChange={e => setRevisionNotes(e.target.value)}
                  placeholder="Describe what needs to be changed or corrected..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevisionNofo(null)}>Cancel</Button>
              <Button onClick={submitRevisionRequest} disabled={!revisionNotes.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
                Submit Revision Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}