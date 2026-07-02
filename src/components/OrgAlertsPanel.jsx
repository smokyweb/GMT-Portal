import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateShort } from '../lib/helpers';

const SEVERITY_CONFIG = {
  Critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  High:     { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  Medium:   { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  Low:      { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

export default function OrgAlertsPanel({ user, apps }) {
  const [flags, setFlags] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  // Dismiss/resolve
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const load = async () => {
    setLoading(true);
    const appIds = new Set(apps.map(a => a.id));
    const [allFlags, allNotifs] = await Promise.all([
      base44.entities.ComplianceFlag.list('-created_date', 100),
      base44.entities.Notification.filter({ recipient_email: user.email }, '-created_date', 50),
    ]);
    setFlags(allFlags.filter(f => appIds.has(f.application_id)));
    setNotifications(allNotifs);
    setLoading(false);
  };

  useEffect(() => { if (apps.length > 0) load(); else setLoading(false); }, [apps.length]);

  const handleResolve = async () => {
    setResolving(true);
    await base44.entities.ComplianceFlag.update(resolveTarget.id, {
      is_resolved: true,
      resolved_by: user.email,
      resolved_at: new Date().toISOString(),
      resolution_notes: resolveNote,
    });
    setResolving(false);
    setResolveTarget(null);
    setResolveNote('');
    load();
  };

  const markNotifRead = async (notif) => {
    await base44.entities.Notification.update(notif.id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
  };

  if (loading) return <div className="flex items-center justify-center p-10"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const openFlags = flags.filter(f => !f.is_resolved);
  const resolvedFlags = flags.filter(f => f.is_resolved);
  const unreadNotifs = notifications.filter(n => !n.is_read);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
            {unreadNotifs.length > 0 && (
              <span className="bg-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unreadNotifs.length}</span>
            )}
          </h3>
          {unreadNotifs.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => notifications.forEach(n => !n.is_read && markNotifRead(n))}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="divide-y max-h-72 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No notifications.</p>
          )}
          {notifications.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition ${!n.is_read ? 'bg-primary/5' : ''}`}
              onClick={() => !n.is_read && markNotifRead(n)}
            >
              {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
              {n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-muted flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'text-muted-foreground'}`}>{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatDateShort(n.created_date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Flags */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Compliance Alerts
            {openFlags.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{openFlags.length} open</span>
            )}
          </h3>
        </div>

        {openFlags.length === 0 && (
          <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" />
            <p className="text-sm font-medium">No open compliance flags</p>
            <p className="text-xs mt-1">Your grants are in good standing.</p>
          </div>
        )}

        {openFlags.map(flag => {
          const cfg = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.Low;
          return (
            <div key={flag.id} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{flag.severity}</span>
                      <span className="text-xs text-muted-foreground">{flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                      {flag.application_number && <span className="text-xs font-mono text-muted-foreground">{flag.application_number}</span>}
                    </div>
                    <p className={`text-sm mt-1 ${cfg.text}`}>{flag.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Flagged {formatDateShort(flag.created_date)}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="flex-shrink-0 text-xs" onClick={() => { setResolveTarget(flag); setResolveNote(''); }}>
                  Resolve
                </Button>
              </div>
            </div>
          );
        })}

        {resolvedFlags.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition py-1"
              onClick={() => setShowResolved(v => !v)}
            >
              {showResolved ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showResolved ? 'Hide' : 'Show'} {resolvedFlags.length} resolved flag{resolvedFlags.length !== 1 ? 's' : ''}
            </button>
            {showResolved && resolvedFlags.map(flag => (
              <div key={flag.id} className="rounded-xl border p-4 bg-muted/30 opacity-70 mt-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Resolved by {flag.resolved_by} · {formatDateShort(flag.resolved_at)}
                      {flag.resolution_notes && ` - "${flag.resolution_notes}"`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={() => setResolveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve Compliance Flag</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{resolveTarget?.description}</p>
            <div>
              <label className="text-sm font-medium">Resolution Notes (optional)</label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder="Describe how this was resolved…"
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolving}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {resolving ? 'Resolving…' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}