import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/toast-simple';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Building2, Pencil, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_ORG = { name: '', type: 'County', ein: '', sam_uei: '', address: '', city: '', state: '', zip: '', county: '', is_active: true };

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scopeState, setScopeState] = useState(null);
  const [editOrg, setEditOrg] = useState(null); // null = closed, object = editing (new if no id)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [allOrgs, user] = await Promise.all([
        base44.entities.Organization.list(),
        base44.auth.me(),
      ]);
      const state = user?.scope_state || null;
      setScopeState(state);
      // Federal admins (no scope_state) see all orgs; state admins see only their state
      const visible = state ? allOrgs.filter(o => o.state === state) : allOrgs;
      setOrgs(visible);
      setLoading(false);
    };
    init();
  }, []);

  const toggleActive = async (org) => {
    try {
      await base44.entities.Organization.update(org.id, { is_active: !org.is_active });
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
    } catch (err) {
      console.error('Failed to toggle org status:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editOrg.id) {
        const updated = await base44.entities.Organization.update(editOrg.id, editOrg);
        setOrgs(prev => prev.map(o => o.id === (updated?.id || editOrg.id) ? { ...o, ...editOrg } : o));
      } else {
        const created = await base44.entities.Organization.create(editOrg);
        if (created?.id) setOrgs(prev => [...prev, created]);
      }
      setEditOrg(null);
    } catch (err) {
      console.error('Failed to save organization:', err);
      toast('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, placeholder = '') => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" placeholder={placeholder} value={editOrg?.[key] || ''}
        onChange={e => setEditOrg(o => ({ ...o, [key]: e.target.value }))} />
    </div>
  );

  const filtered = orgs.filter(o => !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.county?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {orgs.length} registered organization{orgs.length !== 1 ? 's' : ''}
            {scopeState && <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{scopeState}</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditOrg({ ...EMPTY_ORG })}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Organization
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left p-3 font-medium text-muted-foreground">EIN</th>
                <th className="text-left p-3 font-medium text-muted-foreground">SAM UEI</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Active</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => (
                <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Link to={`/organizations/${org.id}`} className="font-medium hover:text-primary hover:underline transition">{org.name}</Link>
                    </div>
                  </td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{org.type}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {[org.city, org.state, org.county].filter(Boolean).join(', ') || ' - '}
                  </td>
                  <td className="p-3 font-mono text-xs">{org.ein || ' - '}</td>
                  <td className="p-3 font-mono text-xs">{org.sam_uei || ' - '}</td>
                  <td className="p-3 text-center"><Switch checked={org.is_active !== false} onCheckedChange={() => toggleActive(org)} /></td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => setEditOrg({ ...org })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No organizations found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit / Create dialog */}
      <Dialog open={!!editOrg} onOpenChange={open => !open && setEditOrg(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOrg?.id ? 'Edit Organization' : 'Add Organization'}</DialogTitle>
          </DialogHeader>
          {editOrg && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('name', 'Organization Name *', 'e.g. County Emergency Management')}
                <div>
                  <Label className="text-xs">Type *</Label>
                  <Select value={editOrg.type} onValueChange={v => setEditOrg(o => ({ ...o, type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['County', 'Municipality', 'Nonprofit', 'Tribe'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {field('ein', 'EIN', 'XX-XXXXXXX')}
                {field('sam_uei', 'SAM UEI', '12-character UEI')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('address', 'Street Address')}
                {field('city', 'City')}
                {field('state', 'State', 'e.g. NE')}
                {field('zip', 'ZIP Code')}
                {field('county', 'County')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !editOrg?.name}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}