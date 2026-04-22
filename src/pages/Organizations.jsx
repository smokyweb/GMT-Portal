import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.entities.Organization.list().then(o => { setOrgs(o); setLoading(false); });
  }, []);

  const toggleActive = async (org) => {
    await base44.entities.Organization.update(org.id, { is_active: !org.is_active });
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_active: !o.is_active } : o));
  };

  const filtered = orgs.filter(o => !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.county?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm mt-1">{orgs.length} registered organizations</p>
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
                <th className="text-left p-3 font-medium text-muted-foreground">County</th>
                <th className="text-left p-3 font-medium text-muted-foreground">EIN</th>
                <th className="text-left p-3 font-medium text-muted-foreground">SAM UEI</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => (
                <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{org.name}</span>
                    </div>
                  </td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{org.type}</span></td>
                  <td className="p-3">{org.county || '—'}</td>
                  <td className="p-3 font-mono text-xs">{org.ein || '—'}</td>
                  <td className="p-3 font-mono text-xs">{org.sam_uei || '—'}</td>
                  <td className="p-3 text-center"><Switch checked={org.is_active !== false} onCheckedChange={() => toggleActive(org)} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No organizations found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}