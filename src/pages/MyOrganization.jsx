import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Check } from 'lucide-react';

export default function MyOrganization() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'Municipality', ein: '', sam_uei: '', address: '', city: '', state: '', zip: '', county: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (u.organization_id) {
        const orgs = await base44.entities.Organization.filter({ id: u.organization_id });
        if (orgs.length > 0) {
          setOrg(orgs[0]);
          setForm(orgs[0]);
        }
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (org) {
      await base44.entities.Organization.update(org.id, { ...form, is_active: true });
    } else {
      const newOrg = await base44.entities.Organization.create({ ...form, is_active: true });
      await base44.auth.updateMe({ organization_id: newOrg.id });
      setOrg(newOrg);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Profile</h1>
          <p className="text-muted-foreground text-sm">{org ? 'Update your organization details' : 'Set up your organization to get started'}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Organization Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="City of Springfield" />
          </div>
          <div>
            <Label>Organization Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['County', 'Municipality', 'Nonprofit', 'Tribe'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>EIN</Label><Input value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} placeholder="XX-XXXXXXX" /></div>
          <div><Label>SAM UEI</Label><Input value={form.sam_uei} onChange={e => setForm(f => ({ ...f, sam_uei: e.target.value }))} /></div>
          <div><Label>County</Label><Input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} /></div>
          <div className="col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
          <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="IL" /></div>
          <div><Label>ZIP Code</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !form.name}>
            {saved ? <><Check className="h-4 w-4 mr-1" /> Saved</> : saving ? 'Saving...' : org ? 'Update Profile' : 'Create Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}