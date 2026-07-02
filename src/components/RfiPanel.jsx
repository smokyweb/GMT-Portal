import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Plus, MessageSquare, Clock } from 'lucide-react';
import { formatDateShort, logAudit, createNotification } from '../lib/helpers';

const STATUS_CONFIG = {
  Open: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
  InProgress: { color: 'bg-amber-100 text-amber-700', icon: Clock },
  PendingAdminReview: { color: 'bg-blue-100 text-blue-700', icon: MessageSquare },
  Resolved: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  Cancelled: { color: 'bg-slate-100 text-slate-500', icon: null },
};

export default function RfiPanel({ applicationId, applicationNumber, organizationName, submittedBy, user, isAdmin = false }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resolvingTask, setResolvingTask] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'High',
    due_date: '',
    assigned_to: submittedBy || '',
  });

  useEffect(() => {
    if (!applicationId) return;
    base44.entities.Task.filter({ application_id: applicationId }, '-created_date', 50)
      .then(t => { setTasks(t); setLoading(false); });
  }, [applicationId]);

  const openCount = tasks.filter(t => !['Resolved', 'Cancelled'].includes(t.status)).length;

  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);
  const [respondingTask, setRespondingTask] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) { setCreateError('Title is required.'); return; }
    setSaving(true);
    setCreateError('');
    setCreateSuccess(false);
    try {
      const task = await base44.entities.Task.create({
        ...form,
        application_id: applicationId,
        application_number: applicationNumber,
        organization_name: organizationName,
        type: 'RFI',
        status: 'Open',
        created_by: user.email,
      });
      // Fire-and-forget: don't block on email/audit
      base44.integrations.Core.SendEmail({
        to: form.assigned_to,
        subject: `Action Required: RFI for Application ${applicationNumber}`,
        body: `An RFI has been issued for application ${applicationNumber}.\n\nTitle: ${form.title}\nDetails: ${form.description}\nDue: ${form.due_date || 'No deadline specified'}\n\nLog in to the GMT Portal to respond.`,
      }).catch(() => {});
      logAudit(base44, user, 'RFICreated', 'Application', applicationId,
        `RFI issued: "${form.title}" ”” assigned to ${form.assigned_to}`).catch(() => {});
      base44.entities.ReviewComment.create({
        entity_type: 'Application',
        entity_id: applicationId,
        reviewer_email: user.email,
        reviewer_name: user.full_name || user.email,
        comment: `RFI issued: "${form.title}" ”” assigned to ${form.assigned_to}. ${form.description || ''}`.trim(),
        action: 'RFICreated',
      }).catch(() => {});
      setTasks(prev => [task, ...prev]);
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreate(false);
        setCreateSuccess(false);
        setForm({ title: '', description: '', priority: 'High', due_date: '', assigned_to: submittedBy || '' });
      }, 1500);
    } catch (err) {
      console.error('RFI create error:', err);
      setCreateError('Failed to create RFI: ' + (err?.message || err?.detail || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResponse = async (task) => {
    if (!responseText.trim()) { alert('Please enter a response.'); return; }
    setSubmittingResponse(true);
    try {
      // Save the response on the task
      await base44.entities.Task.update(task.id, {
        status: 'PendingAdminReview',
        notes: responseText.trim(),
        resolved_by: user?.email,
        resolved_at: new Date().toISOString(),
      });
      // Log the response
      await logAudit(base44, user, 'RFIResponse', 'Application', applicationId,
        `Response submitted for RFI "${task.title}": ${responseText.trim().substring(0, 100)}`).catch(() => {});
      // Notify the admin/reviewer who created the RFI
      try {
        const adminEmail = task.created_by || 'admin';
        createNotification(base44, adminEmail,
          'RFI Response Submitted',
          `${user?.full_name || user?.email} responded to RFI "${task.title}" for ${applicationNumber}.`,
          'rfi_response', 'Application', applicationId, '/applications'
        ).catch(() => {});
        // Fire-and-forget email
        base44.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `RFI Response: ${task.title} ”” ${applicationNumber}`,
          body: `A response has been submitted for RFI "${task.title}" on application ${applicationNumber}.\n\nResponse:\n${responseText.trim()}\n\nLog in to review: https://gmt.bluesapps.com/applications`,
        }).catch(() => {});
      } catch {}
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PendingAdminReview', notes: responseText.trim() } : t));
      setRespondingTask(null);
      setResponseText('');
    } catch (err) {
      console.error('RFI response error:', err);
      alert('Failed to submit response: ' + (err?.message || 'Please try again.'));
    } finally {
      setSubmittingResponse(false);
    }
  };

    const handleResolve = async () => {
    setSaving(true);
    const update = {
      status: 'Resolved',
      resolution_notes: resolveNotes,
      resolved_by: user.email,
      resolved_at: new Date().toISOString(),
    };
    await base44.entities.Task.update(resolvingTask.id, update);
    await logAudit(base44, user, 'RFIResolved', 'Application', applicationId,
      `RFI resolved: "${resolvingTask.title}"`);
    setTasks(prev => prev.map(t => t.id === resolvingTask.id ? { ...t, ...update } : t));
    setResolvingTask(null);
    setResolveNotes('');
    setSaving(false);
  };

  const handleStatusChange = async (task, newStatus) => {
    await base44.entities.Task.update(task.id, { status: newStatus });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading RFIs…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">RFI Tracker</h3>
          {openCount > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5">
              âš  {openCount} open RFI{openCount !== 1 ? 's' : ''} ”” approval is blocked until resolved
            </p>
          )}
          {openCount === 0 && tasks.length > 0 && (
            <p className="text-xs text-green-600 font-medium mt-0.5">âœ“ All RFIs resolved</p>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New RFI
          </Button>
        )}
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No RFIs for this application.</p>
      )}

      <div className="space-y-2">
        {tasks.map(task => {
          const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.Open;
          const Icon = cfg.icon;
          return (
            <div key={task.id} className="border rounded-lg p-3 bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {Icon && <Icon className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />}
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{task.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        task.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                        task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{task.priority}</span>
                      {task.due_date && <span className="text-xs text-muted-foreground">Due: {formatDateShort(task.due_date)}</span>}
                      {task.assigned_to && <span className="text-xs text-muted-foreground">â†’ {task.assigned_to}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!isAdmin && task.status === 'Open' && (
                    <Button size="sm" variant="outline" onClick={() => { handleStatusChange(task, 'InProgress'); setRespondingTask(task); setResponseText(''); }}>
                      Respond
                    </Button>
                  )}
                  {!isAdmin && task.status === 'InProgress' && respondingTask?.id !== task.id && (
                    <Button size="sm" variant="outline" onClick={() => { setRespondingTask(task); setResponseText(task.notes || ''); }}>
                      Respond
                    </Button>
                  )}
                  {isAdmin && ['Open', 'InProgress', 'PendingAdminReview'].includes(task.status) && (
                    <Button size="sm" onClick={() => { setResolvingTask(task); setResolveNotes(''); }}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </div>
              {task.resolution_notes && (
                <div className="text-xs bg-green-50 border border-green-200 text-green-800 rounded p-2">
                  <span className="font-semibold">Resolution: </span>{task.resolution_notes}
                </div>
              )}
              {/* Show submitted response if exists */}
              {task.notes && task.status === 'PendingAdminReview' && !isAdmin && (
                <div className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded p-2">
                  <span className="font-semibold">Your Response: </span>{task.notes}
                </div>
              )}
              {task.notes && task.status === 'PendingAdminReview' && isAdmin && (
                <div className="text-xs bg-purple-50 border border-purple-200 text-purple-800 rounded p-2">
                  <span className="font-semibold">Subrecipient Response: </span>{task.notes}
                </div>
              )}
              {/* Inline response form */}
              {!isAdmin && respondingTask?.id === task.id && (
                <div className="mt-2 space-y-2 border-t pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">Your Response</p>
                  <textarea
                    className="w-full text-sm border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={4}
                    placeholder="Provide your response to this RFI. Include any supporting information or documentation references..."
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium disabled:opacity-50"
                      disabled={submittingResponse || !responseText.trim()}
                      onClick={() => handleResponse(task)}
                    >
                      {submittingResponse ? 'Submitting...' : 'Submit Response'}
                    </button>
                    <button
                      className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-3 py-1.5 rounded-md"
                      onClick={() => { setRespondingTask(null); setResponseText(''); }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create RFI Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create RFI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input className="mt-1" placeholder="e.g., Missing Sole Source Justification" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={3} placeholder="Describe the deficiency or information needed..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Low', 'Medium', 'High', 'Critical'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" className="mt-1" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Assign To (Email) <span className="text-xs text-muted-foreground font-normal">”” optional, auto-filled if available</span></Label>
              <Input className="mt-1" type="email" placeholder="subrecipient@org.gov" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} />
            </div>
          </div>
          {createError && (
            <div className="mx-6 mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{createError}</div>
          )}
          {createSuccess && (
            <div className="mx-6 mb-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">âœ“ RFI created successfully!</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title || createSuccess}>
              {saving ? 'Creating…' : 'Create RFI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolvingTask} onOpenChange={o => { if (!o) { setResolvingTask(null); setResolveNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Resolve RFI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <p className="font-medium">{resolvingTask?.title}</p>
              {resolvingTask?.description && <p className="text-muted-foreground mt-1">{resolvingTask?.description}</p>}
            </div>
            <div>
              <Label>Resolution Notes</Label>
              <Textarea className="mt-1" rows={3} placeholder="How was this resolved?" value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolvingTask(null); setResolveNotes(''); }}>Cancel</Button>
            <Button onClick={handleResolve} disabled={saving}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {saving ? 'Resolving…' : 'Confirm Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}