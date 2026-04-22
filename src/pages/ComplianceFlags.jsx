import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import { formatDateShort, logAudit } from '../lib/helpers';
import { onComplianceFlagResolved } from '../lib/workflowEngine';

export default function ComplianceFlags() {
  const [flags, setFlags] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ComplianceFlag.list('-created_date', 100),
      base44.auth.me(),
    ]).then(([f, u]) => {
      setFlags(f);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const resolve = async (flag) => {
    await base44.entities.ComplianceFlag.update(flag.id, {
      is_resolved: true,
      resolved_by: user.email,
      resolved_at: new Date().toISOString(),
    });
    await logAudit(base44, user, 'Resolved', 'ComplianceFlag', flag.id, `Resolved: ${flag.description}`);
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_resolved: true, resolved_by: user.email } : f));
    // Trigger workflow: check if all flags resolved
    await onComplianceFlagResolved(base44, flag.application_id);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const open = flags.filter(f => !f.is_resolved);
  const resolved = flags.filter(f => f.is_resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Flags</h1>
        <p className="text-muted-foreground text-sm mt-1">{open.length} open flags, {resolved.length} resolved</p>
      </div>

      {/* Open Flags */}
      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Open Flags ({open.length})</h2>
        </div>
        <div className="divide-y">
          {open.map(flag => (
            <div key={flag.id} className="flex items-center justify-between p-4">
              <div className="flex items-start gap-3">
                <SeverityBadge severity={flag.severity} />
                <div>
                  <p className="text-sm font-medium">{flag.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()} • {flag.organization_name} • {flag.application_number}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => resolve(flag)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
              </Button>
            </div>
          ))}
          {open.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No open flags</p>}
        </div>
      </div>

      {/* Resolved Flags */}
      {resolved.length > 0 && (
        <div className="bg-card rounded-xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-muted-foreground">Resolved ({resolved.length})</h2>
          </div>
          <div className="divide-y">
            {resolved.slice(0, 10).map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-4 opacity-60">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={flag.severity} />
                  <div>
                    <p className="text-sm font-medium line-through">{flag.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Resolved by {flag.resolved_by} on {formatDateShort(flag.resolved_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}