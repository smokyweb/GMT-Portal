import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Plus, Pencil, Trash2, Users, Globe, Palette,
  CheckCircle, Search, Shield, LayoutDashboard, Upload
} from 'lucide-react';

const EMPTY_FORM = {
  name: '', state_code: '', agency_name: '', contact_name: '', contact_email: '',
  contact_phone: '', address: '', city: '', state: '', zip: '',
  logo_url: '', primary_color: '#2563eb', secondary_color: '#1e3a5f',
  portal_title: '', portal_subtitle: '', is_active: true, max_users: 50, notes: '',
};

export default function ISCDashboard() {
  const [user, setUser] = useState(null);
  const [grantees, setGrantees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [stats, setStats] = useState({});

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const g = await base44.entities.Grantee.list('-created_date', 200);
      setGrantees(g);
      // Fetch org counts per grantee
      const orgs = await base44.entities.Organization.list('-created_date', 500);
      const apps = await base44.entities.Application.list('-created_date', 500);
      const statMap = {};
      g.forEach(gr => {
        statMap[gr.id] = {
          orgs: orgs.filter(o => o.grantee_id === gr.id).length,
          apps: apps.filter(a => a.grantee_id === gr.id).length,
        };
      });
      setStats(statMap);
      setLoading(false);
    });
  }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (g) => { setEditing(g); setForm({ ...EMPTY_FORM, ...g }); setShowForm(true); };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.state_code) return;
    setSaving(true);
    if (editing) {
      await base44.entities.Grantee.update(editing.id, form);
      setGrantees(prev => prev.map(g => g.id === editing.id ? { ...g, ...form } : g));
    } else {
      const created = await base44.entities.Grantee.create(form);
      setGrantees(prev => [created, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Grantee.delete(deleteTarget.id);
    setGrantees(prev => prev.filter(g => g.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const filtered = grantees.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.state_code?.toLowerCase().includes(search.toLowerCase()) ||
    g.contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const activeCount = grantees.filter(g => g.is_active).length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ISC Administrator Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all state grantees, their branding, and system configuration.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Add Grantee</Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Grantees', value: grantees.length, icon: Building2, color: 'bg-blue-50 text-blue-600' },
          { label: 'Active', value: activeCount, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: 'Inactive', value: grantees.length - activeCount, icon: Shield, color: 'bg-slate-50 text-slate-600' },
          { label: 'Programs Covered', value: [...new Set(grantees.flatMap(g => g.grant_programs || []))].length, icon: Globe, color: 'bg-purple-50 text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search grantees…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grantee Grid */}
      {filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No grantees found</p>
          <p className="text-sm mt-1">Add your first state grantee to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(g => (
            <div key={g.id} className={`bg-card border rounded-xl overflow-hidden ${!g.is_active ? 'opacity-60' : ''}`}>
              {/* Branding header */}
              <div
                className="h-16 flex items-center px-4 gap-3"
                style={{ backgroundColor: g.primary_color || '#1e3a5f' }}
              >
                {g.logo_url ? (
                  <img src={g.logo_url} alt="logo" className="h-10 w-10 rounded-lg object-contain bg-white p-1" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="text-white min-w-0">
                  <p className="font-bold text-sm truncate">{g.portal_title || g.name}</p>
                  <p className="text-xs text-white/70 truncate">{g.portal_subtitle || g.agency_name || g.state_code}</p>
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${g.is_active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                  {g.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">State Code</p>
                    <p className="font-mono font-bold">{g.state_code}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max Users</p>
                    <p className="font-medium">{g.max_users || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium truncate">{g.contact_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="truncate">{g.contact_email || '—'}</p>
                  </div>
                </div>

                {g.grant_programs?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.grant_programs.map(p => (
                      <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{p}</span>
                    ))}
                  </div>
                )}

                {/* Color swatches */}
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: g.primary_color || '#2563eb' }} title="Primary" />
                  <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: g.secondary_color || '#1e3a5f' }} title="Secondary" />
                  <span className="text-xs text-muted-foreground ml-1">Brand colors</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(g)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(g)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Grantee' : 'Add State Grantee'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="info">
            <TabsList className="mb-4">
              <TabsTrigger value="info">Basic Info</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>State / Grantee Name <span className="text-red-500">*</span></Label>
                  <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. California Emergency Management" />
                </div>
                <div>
                  <Label>State Code <span className="text-red-500">*</span></Label>
                  <Input className="mt-1" value={form.state_code} onChange={e => setForm(f => ({ ...f, state_code: e.target.value.toUpperCase() }))} placeholder="e.g. CA" maxLength={5} />
                </div>
                <div>
                  <Label>Agency Name</Label>
                  <Input className="mt-1" value={form.agency_name} onChange={e => setForm(f => ({ ...f, agency_name: e.target.value }))} placeholder="e.g. Cal OES" />
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input className="mt-1" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input className="mt-1" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input className="mt-1" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input className="mt-1" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input className="mt-1" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </TabsContent>

            <TabsContent value="branding" className="space-y-4">
              <p className="text-sm text-muted-foreground">Customize how this grantee's portal looks. These settings are applied to their system's navigation and header.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Portal Title</Label>
                  <Input className="mt-1" value={form.portal_title} onChange={e => setForm(f => ({ ...f, portal_title: e.target.value }))} placeholder="e.g. CA Grants Portal" />
                </div>
                <div>
                  <Label>Portal Subtitle</Label>
                  <Input className="mt-1" value={form.portal_subtitle} onChange={e => setForm(f => ({ ...f, portal_subtitle: e.target.value }))} placeholder="e.g. Cal OES Grant Management" />
                </div>
              </div>

              <div>
                <Label>Logo Upload</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition ${uploadingLogo ? 'opacity-50 cursor-wait' : 'hover:bg-muted/60'}`}>
                      <Upload className="h-4 w-4" />{uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                    </span>
                  </label>
                  {form.logo_url && <img src={form.logo_url} alt="logo preview" className="h-12 rounded-lg border object-contain p-1" />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="h-9 w-14 rounded border cursor-pointer" />
                    <Input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="font-mono" />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="h-9 w-14 rounded border cursor-pointer" />
                    <Input value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="font-mono" />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div>
                <Label className="text-xs text-muted-foreground">Live Sidebar Preview</Label>
                <div className="mt-2 rounded-xl overflow-hidden border w-64">
                  <div className="h-14 flex items-center px-3 gap-2" style={{ backgroundColor: form.primary_color }}>
                    {form.logo_url
                      ? <img src={form.logo_url} className="h-8 w-8 rounded object-contain bg-white p-0.5" alt="logo" />
                      : <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center"><Shield className="h-4 w-4 text-white" /></div>
                    }
                    <div>
                      <p className="text-white text-xs font-bold">{form.portal_title || form.name || 'Portal Title'}</p>
                      <p className="text-white/60 text-[10px]">{form.portal_subtitle || form.agency_name || 'Subtitle'}</p>
                    </div>
                  </div>
                  <div className="p-2 space-y-1" style={{ backgroundColor: form.secondary_color }}>
                    {['Dashboard', 'Applications', 'Compliance'].map(item => (
                      <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded text-white/70 text-xs">
                        <LayoutDashboard className="h-3 w-3" />{item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max Users Allowed</Label>
                  <Input className="mt-1" type="number" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label>Grant Programs (comma-separated)</Label>
                <Input
                  className="mt-1"
                  value={(form.grant_programs || []).join(', ')}
                  onChange={e => setForm(f => ({ ...f, grant_programs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="SHSP, UASI, EMPG"
                />
                <p className="text-xs text-muted-foreground mt-1">Programs this grantee is authorized to administer.</p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.state_code}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Grantee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Grantee</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />{deleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}