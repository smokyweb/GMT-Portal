import OrganizationAwardContacts from '@/components/gan/OrganizationAwardContacts';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Check, AlertCircle } from 'lucide-react';
import OrgUserManagement from '../components/OrgUserManagement';
import OrgAlertsPanel from '../components/OrgAlertsPanel';

export default function MyOrganization() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [apps, setApps] = useState([]);
  const [form, setForm] = useState({
    name: '', type: 'Municipality', ein: '', sam_uei: '', legacy_spars_id: '', vendor_number: '', duns: '', region: '', nonprofit_category: '', address: '', address_line_2: '', city: '', state: '', zip: '', county: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [legacyConfig, setLegacyConfig] = useState({ enabled: false, systemName: '', canEdit: false });

  const FORM_FIELDS = ['name', 'type', 'ein', 'sam_uei', 'legacy_spars_id', 'vendor_number', 'duns', 'region', 'nonprofit_category', 'address', 'address_line_2', 'city', 'state', 'zip', 'county'];
  const extractForm = (o) => FORM_FIELDS.reduce((acc, k) => ({ ...acc, [k]: o[k] || '' }), { type: o.type || 'Municipality' });

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const grantees = await base44.entities.Grantee.list('-created_date').catch(() => []);
      const grantee = (grantees || []).find(g => g.id === u.grantee_id || g.state_code === u.scope_state);
      setLegacyConfig({ enabled: Boolean(grantee?.legacy_fields_enabled), systemName: grantee?.legacy_system_name?.trim() || '', canEdit: Boolean(grantee?.legacy_fields_enabled && ['admin', 'isc_admin'].includes(u.role)) });
      try {
        if (u.organization_id) {
          // Load org by listing all and finding by id (filter by id not always supported)
          const [allOrgs, myApps] = await Promise.all([
            base44.entities.Organization.list('-created_date').catch(() => []),
            base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date').catch(() => []),
          ]);
          const found = allOrgs.find(o => o.id === u.organization_id);
          if (found) {
            setOrg(found);
            const extracted = extractForm(found);
            setForm({ ...extracted, state: extracted.state || grantee?.state_code || '' });
          }
          setApps(Array.isArray(myApps) ? myApps : []);
        }
      } catch (e) {
        console.error('Failed to load org:', e);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (form.type === 'Nonprofit' && !form.nonprofit_category) { setError('Nonprofit Category is required.'); setSaving(false); return; }
      const data = { ...form, is_active: true };
      if (!legacyConfig.canEdit) ['legacy_spars_id', 'duns', 'region'].forEach(key => delete data[key]);
      if (org) {
        await base44.entities.Organization.update(org.id, data);
        setOrg(prev => ({ ...prev, ...data }));
      } else {
        const newOrg = await base44.entities.Organization.create(data);
        setOrg(newOrg);
        // Link org to user - try updateMe, fall back to user entity update
        try {
          await base44.auth.updateMe({ organization_id: newOrg.id });
        } catch {
          // If updateMe doesn't exist, update user entity directly
          if (user?.id) {
            await base44.entities.User.update(user.id, { organization_id: newOrg.id }).catch(() => {});
          }
        }
        setUser(prev => ({ ...prev, organization_id: newOrg.id }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save org error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Organization</h1>
          <p className="text-muted-foreground text-sm">{org ? org.name : 'Set up your organization to get started'}</p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="bg-card rounded-xl border p-6 space-y-4 max-w-2xl">
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
                    {['County', 'Municipality', 'Nonprofit', 'Tribe', 'Local Jurisdiction', 'Local Jurisdiction State Agency', 'State Agency', 'Federal Agency', 'University', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
{form.type === 'Nonprofit' && <div><Label>Nonprofit Category *</Label><Select value={form.nonprofit_category || '__none__'} onValueChange={v => setForm(f => ({ ...f, nonprofit_category: v === '__none__' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="__none__">Select category</SelectItem><SelectItem value="Ideology-based/Spiritual/Religious">Ideology-based/Spiritual/Religious</SelectItem><SelectItem value="Educational (secular)">Educational (secular)</SelectItem><SelectItem value="Medical">Medical</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>}              <div><Label>EIN</Label><Input value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} placeholder="XX-XXXXXXX" /></div>
              <div><Label>SAM UEI</Label><Input value={form.sam_uei} onChange={e => setForm(f => ({ ...f, sam_uei: e.target.value }))} /></div>
              {legacyConfig.enabled && <div className="col-span-2 rounded-lg border p-4 space-y-3"><div><Label>Legacy / Payment Info</Label><p className="text-xs text-muted-foreground">Imported legacy identifiers are read-only. Address Book # is editable and unique within Nebraska.</p></div><div className="grid grid-cols-2 gap-4"><div><Label>{legacyConfig.systemName ? legacyConfig.systemName + ' ID' : 'Legacy ID'}</Label><Input readOnly className="bg-muted" value={form.legacy_spars_id} /></div><div><Label>Address Book #</Label><Input disabled={!legacyConfig.canEdit} value={form.vendor_number} onChange={e => setForm(f => ({ ...f, vendor_number: e.target.value }))} /></div><div><Label>DUNS (legacy)</Label><Input readOnly className="bg-muted" value={form.duns} /></div><div><Label>Region</Label><Input readOnly className="bg-muted" value={form.region} /></div></div></div>}

              <div><Label>County</Label><Input value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Address Line 2</Label><Input value={form.address_line_2} onChange={e => setForm(f => ({ ...f, address_line_2: e.target.value }))} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="IL" /></div>
              <div><Label>ZIP Code</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Check className="h-4 w-4 flex-shrink-0" />
                Organization saved successfully.
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving ? 'Saving...' : org ? 'Update Profile' : 'Create Profile'}
              </Button>
            </div>
          </div>
          {org&&<OrganizationAwardContacts organizationId={org.id}/>}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {user && org ? <OrgUserManagement user={user} org={org} /> : <p className="text-sm text-muted-foreground">Set up your organization profile first.</p>}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          {user ? <OrgAlertsPanel user={user} apps={apps} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
