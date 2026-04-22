import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, User, Building2, Mail, Shield } from 'lucide-react';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({ full_name: '', phone: '', title: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      setForm({
        full_name: u.full_name || '',
        phone: u.phone || '',
        title: u.title || '',
        department: u.department || '',
      });
      if (u.organization_id) {
        const orgs = await base44.entities.Organization.filter({ id: u.organization_id });
        if (orgs.length) setOrg(orgs[0]);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ phone: form.phone, title: form.title, department: form.department });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const roleLabel = (role) => {
    if (role === 'admin') return 'State Admin';
    if (role === 'reviewer') return 'Reviewer';
    return 'Subrecipient';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">View and update your account details.</p>
      </div>

      {/* Avatar + identity */}
      <div className="bg-card border rounded-xl p-6 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-primary">{user?.full_name?.charAt(0) || 'U'}</span>
        </div>
        <div>
          <p className="text-xl font-bold">{user?.full_name || '—'}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3.5 w-3.5" /> {user?.email}
          </p>
          <span className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium ${
            user?.role === 'admin' ? 'bg-purple-50 text-purple-700' :
            user?.role === 'reviewer' ? 'bg-blue-50 text-blue-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            <Shield className="h-3 w-3" /> {roleLabel(user?.role)}
          </span>
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personal Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Full Name</Label>
            <Input className="mt-1" value={form.full_name} disabled placeholder="—" />
            <p className="text-xs text-muted-foreground mt-1">Managed by your account provider.</p>
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" value={user?.email || ''} disabled />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Grants Manager" />
          </div>
          <div>
            <Label>Department</Label>
            <Input className="mt-1" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Public Safety" />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. (555) 123-4567" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" /> Saved successfully
            </span>
          )}
        </div>
      </div>

      {/* Organization info */}
      {org && (
        <div className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{org.name}</p></div>
            <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{org.type || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">EIN</p><p className="font-medium">{org.ein || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">SAM UEI</p><p className="font-medium">{org.sam_uei || '—'}</p></div>
            {org.city && <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{org.city}, {org.state}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}