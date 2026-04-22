import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Flag, Plus, Check, Clock, AlertTriangle, CalendarDays,
  ChevronDown, ChevronUp, Send, Pencil, Trash2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { isStateUser } from '../lib/helpers';
import moment from 'moment';
import MilestoneCalendar from '../components/MilestoneCalendar';
import ApplicationHistory from '../components/ApplicationHistory';

const MILESTONE_TYPES = [
  'ProjectKickoff', 'MidTermReview', 'FinalReport', 'BudgetReview',
  'SiteVisit', 'QuarterlyCheck', 'CloseOut', 'Custom'
];

const STATUS_CONFIG = {
  Upcoming:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400',   icon: Clock },
  InProgress: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  icon: Clock },
  Completed:  { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  icon: Check },
  Overdue:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    icon: AlertTriangle },
  Waived:     { bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-300',  icon: X },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.Upcoming;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="h-3 w-3" />{status}
    </span>
  );
}

const BLANK_FORM = {
  title: '', description: '', milestone_type: 'ProjectKickoff',
  due_date: '', assigned_to: '', notes: '', status: 'Upcoming'
};

export default function MilestoneTracker() {
  const [user, setUser] = useState(null);
  const [apps, setApps] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [expandedApps, setExpandedApps] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [formAppId, setFormAppId] = useState('');
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [remindersRunning, setRemindersRunning] = useState(false);
  const [selectedAppForDetails, setSelectedAppForDetails] = useState(null);
  const [detailsTab, setDetailsTab] = useState('history');
  const [reports, setReports] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const isState = isStateUser(u?.role);
      let appList, milestoneList, reportList;
      if (isState) {
        [appList, milestoneList, reportList] = await Promise.all([
          base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 200),
          base44.entities.Milestone.list('-due_date', 500),
          base44.entities.ReportSchedule.list('-due_date', 500),
        ]);
      } else {
        const orgId = u?.organization_id;
        if (!orgId) { setLoading(false); return; }
        [appList, milestoneList, reportList] = await Promise.all([
          base44.entities.Application.filter({ organization_id: orgId, status: 'Approved' }, '-created_date', 50),
          base44.entities.Milestone.filter({ organization_id: orgId }, '-due_date', 200),
          base44.entities.ReportSchedule.filter({ }, '-due_date', 200),
        ]);
      }
      setApps(appList);
      setMilestones(milestoneList);
      setReports(reportList);
      // Auto-expand apps that have overdue/upcoming milestones
      const autoExpand = {};
      appList.forEach(a => autoExpand[a.id] = true);
      setExpandedApps(autoExpand);
      setLoading(false);
    });
  }, []);

  const reload = async () => {
    const isState = isStateUser(user?.role);
    const list = isState
      ? await base44.entities.Milestone.list('-due_date', 500)
      : await base44.entities.Milestone.filter({ organization_id: user?.organization_id }, '-due_date', 200);
    // Recompute overdue statuses
    const updated = await Promise.all(list.map(async m => {
      if (m.status === 'Upcoming' || m.status === 'InProgress') {
        if (moment(m.due_date).isBefore(moment(), 'day')) {
          await base44.entities.Milestone.update(m.id, { status: 'Overdue' });
          return { ...m, status: 'Overdue' };
        }
      }
      return m;
    }));
    setMilestones(updated);
  };

  const openCreate = (appId) => {
    setFormAppId(appId);
    setEditingMilestone(null);
    setForm(BLANK_FORM);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setFormAppId(m.application_id);
    setEditingMilestone(m);
    setForm({
      title: m.title, description: m.description || '',
      milestone_type: m.milestone_type || 'Custom',
      due_date: m.due_date, assigned_to: m.assigned_to || '',
      notes: m.notes || '', status: m.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const app = apps.find(a => a.id === formAppId);
    const payload = {
      ...form,
      application_id: formAppId,
      application_number: app?.application_number || '',
      organization_name: app?.organization_name || '',
      organization_id: app?.organization_id || '',
      program_code: app?.program_code || '',
    };
    if (editingMilestone) {
      const prevAssignee = editingMilestone.assigned_to;
      const updated = await base44.entities.Milestone.update(editingMilestone.id, payload);
      // Notify if a new assignee was set
      if (form.assigned_to && form.assigned_to !== prevAssignee) {
        await base44.functions.invoke('notifyMilestoneAssignee', {
          milestone_id: editingMilestone.id,
          trigger_type: 'created',
        });
      }
    } else {
      const created = await base44.entities.Milestone.create(payload);
      // Notify assignee immediately on creation
      if (form.assigned_to && created?.id) {
        await base44.functions.invoke('notifyMilestoneAssignee', {
          milestone_id: created.id,
          trigger_type: 'created',
        });
      }
    }
    setShowForm(false);
    await reload();
    setSaving(false);
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete milestone "${m.title}"?`)) return;
    await base44.entities.Milestone.delete(m.id);
    setMilestones(prev => prev.filter(x => x.id !== m.id));
  };

  const handleMarkComplete = async (m) => {
    await base44.entities.Milestone.update(m.id, {
      status: 'Completed',
      completed_date: moment().format('YYYY-MM-DD'),
    });
    await reload();
  };

  const sendReminders = async () => {
    setRemindersRunning(true);
    const soon = milestones.filter(m => {
      if (m.status === 'Completed' || m.status === 'Waived') return false;
      const daysUntil = moment(m.due_date).diff(moment(), 'days');
      return daysUntil >= 0 && daysUntil <= 7;
    });
    await Promise.all(soon.map(async m => {
      if (m.assigned_to) {
        await base44.integrations.Core.SendEmail({
          to: m.assigned_to,
          subject: `Upcoming Milestone Reminder: ${m.title} — ${m.application_number}`,
          body: `This is a reminder that the following milestone is due soon:\n\nMilestone: ${m.title}\nApplication: ${m.application_number}\nOrganization: ${m.organization_name}\nDue Date: ${moment(m.due_date).format('MMMM D, YYYY')} (${moment(m.due_date).fromNow()})\n\nPlease log in to the GMT Portal to update your progress.`,
        });
        await base44.entities.Milestone.update(m.id, { reminder_sent: true });
      }
    }));
    await reload();
    setRemindersRunning(false);
    alert(`Sent ${soon.filter(m => m.assigned_to).length} reminder email(s).`);
  };

  const getMilestonesForApp = (appId) =>
    milestones.filter(m => m.application_id === appId)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const getReportsForApp = (appId) =>
    reports.filter(r => r.application_id === appId)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const isState = isStateUser(user?.role);

  // Global stats
  const totalOverdue = milestones.filter(m => m.status === 'Overdue').length + reports.filter(r => r.status === 'Overdue').length;
  const dueSoon = milestones.filter(m => {
    const d = moment(m.due_date).diff(moment(), 'days');
    return d >= 0 && d <= 7 && m.status !== 'Completed' && m.status !== 'Waived';
  }).length + reports.filter(r => {
    const d = moment(r.due_date).diff(moment(), 'days');
    return d >= 0 && d <= 7 && r.status !== 'Submitted' && r.status !== 'Approved';
  }).length;
  const totalCompleted = milestones.filter(m => m.status === 'Completed').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Milestone Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isState ? 'Define and track milestones across all approved grants' : 'Track your grant milestones and deadlines'}
          </p>
        </div>
        {isState && (
          <Button
            variant="outline"
            onClick={sendReminders}
            disabled={remindersRunning}
          >
            <Send className="h-4 w-4 mr-1.5" />
            {remindersRunning ? 'Sending…' : `Send Reminders (7-day window)`}
          </Button>
        )}
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 ${totalOverdue > 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${totalOverdue > 0 ? 'text-red-600' : ''}`}>{totalOverdue}</p>
        </div>
        <div className={`border rounded-xl p-4 ${dueSoon > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
          <p className="text-xs text-muted-foreground">Due in 7 Days</p>
          <p className={`text-2xl font-bold mt-1 ${dueSoon > 0 ? 'text-amber-600' : ''}`}>{dueSoon}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold mt-1 text-green-700">{totalCompleted}</p>
        </div>
      </div>

      {apps.length === 0 && (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No approved grants found.</p>
          <p className="text-sm mt-1">Milestones are tracked on approved grant applications.</p>
        </div>
      )}

      {/* Apps with milestones */}
      {apps.map(app => {
        const appMilestones = getMilestonesForApp(app.id);
        const expanded = expandedApps[app.id];
        const hasOverdue = appMilestones.some(m => m.status === 'Overdue');
        const completedCount = appMilestones.filter(m => m.status === 'Completed').length;
        const pct = appMilestones.length > 0 ? Math.round((completedCount / appMilestones.length) * 100) : 0;

        return (
          <div key={app.id} className={`bg-card border rounded-xl overflow-hidden ${hasOverdue ? 'border-red-200' : ''}`}>
            {/* App header */}
            <div
            className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition
              ${hasOverdue ? 'bg-red-50/40' : 'bg-muted/10'}`}
            onClick={() => {
              setSelectedAppForDetails(app.id);
              setDetailsTab('history');
            }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Flag className={`h-4 w-4 flex-shrink-0 ${(() => {
                 const appReports = getReportsForApp(app.id);
                 const reportOverdue = appReports.some(r => r.status === 'Overdue');
                 return (hasOverdue || reportOverdue) ? 'text-red-500' : 'text-muted-foreground';
               })()}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{app.application_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.organization_name} · {app.program_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {appMilestones.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{completedCount}/{appMilestones.length}</span>
                  </div>
                )}
                {isState && (
                  <Button
                    size="sm" variant="ghost"
                    onClick={e => { e.stopPropagation(); openCreate(app.id); }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                )}
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Details Panel */}
            {selectedAppForDetails === app.id && (
              <div className="border-t bg-muted/20 p-4">
                {/* Tab buttons */}
                <div className="flex gap-2 mb-4 border-b">
                  <button
                    onClick={() => setDetailsTab('history')}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                      detailsTab === 'history'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    History
                  </button>
                  <button
                    onClick={() => setDetailsTab('calendar')}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                      detailsTab === 'calendar'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Calendar
                  </button>
                </div>
                {detailsTab === 'history' && (
                  <ApplicationHistory milestones={milestones} applicationId={app.id} />
                )}
                {detailsTab === 'calendar' && (
                  <MilestoneCalendar milestones={milestones} applicationId={app.id} />
                )}
              </div>
            )}

            {/* Milestone & Reports list */}
             {expanded && selectedAppForDetails !== app.id && (
               <div>
                 {appMilestones.length === 0 && getReportsForApp(app.id).length === 0 ? (
                   <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                     No milestones or reports yet.{isState && ' Click "Add" to define the first milestone.'}
                   </div>
                 ) : (
                   <div className="relative">
                     {/* Vertical timeline line */}
                     <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />
                     <div className="space-y-0">
                       {(() => {
                         // Combine and sort milestones + reports by due date
                         const combined = [
                           ...appMilestones.map(m => ({ ...m, type: 'milestone' })),
                           ...getReportsForApp(app.id).map(r => ({ ...r, type: 'report' }))
                         ].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                         return combined.map((item, idx) => {
                           const isReport = item.type === 'report';
                           const m = item;

                        const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.Upcoming;
                        const daysUntil = moment(m.due_date).diff(moment(), 'days');
                        const isLast = idx === combined.length - 1;
                        const reportStatus = isReport ? m.status : null;
                        const reportStatusColor = reportStatus === 'Overdue' ? 'text-red-600' : reportStatus === 'Pending' ? 'text-amber-600' : reportStatus === 'Approved' ? 'text-green-600' : 'text-muted-foreground';
                        return (
                          <div key={m.id} className={`relative flex gap-4 px-4 py-3 hover:bg-muted/20 transition ${!isLast ? 'border-b' : ''}`}>
                            {/* Timeline dot */}
                            <div className={`flex-shrink-0 w-8 flex items-start justify-center pt-0.5 z-10`}>
                              {isReport ? (
                                <div className="h-4 w-4 rounded-full border-2 border-background bg-purple-500" title="Report Due Date" />
                              ) : (
                                <div className={`h-4 w-4 rounded-full border-2 border-background ${cfg.dot}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{m.title}</p>
                                    {isReport ? (
                                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 ${reportStatusColor}`}>
                                        {m.status}
                                      </span>
                                    ) : (
                                      <StatusBadge status={m.status} />
                                    )}
                                    {!isReport && m.milestone_type !== 'Custom' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                        {m.milestone_type.replace(/([A-Z])/g, ' $1').trim()}
                                      </span>
                                    )}
                                    {isReport && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                                        {m.report_type} Report
                                      </span>
                                    )}
                                    {m.reminder_sent && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium flex items-center gap-0.5">
                                        <Send className="h-2.5 w-2.5" /> Reminded
                                      </span>
                                    )}
                                  </div>
                                  {!isReport && m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      Due {moment(m.due_date).format('MMM D, YYYY')}
                                      {m.status !== 'Completed' && m.status !== 'Waived' && (
                                        <span className={`ml-1 font-medium ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                          ({daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'today' : `in ${daysUntil}d`})
                                        </span>
                                      )}
                                    </span>
                                    {m.assigned_to && <span className="text-xs text-muted-foreground">→ {m.assigned_to}</span>}
                                    {!isReport && m.completed_date && (
                                        <span className="text-xs text-green-600">✓ Completed {moment(m.completed_date).format('MMM D, YYYY')}</span>
                                      )}
                                    </div>
                                    {!isReport && m.notes && <p className="text-xs italic text-muted-foreground mt-1">{m.notes}</p>}
                                </div>
                                {isState && !isReport && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {m.status !== 'Completed' && m.status !== 'Waived' && (
                                      <Button size="sm" variant="ghost" onClick={() => handleMarkComplete(m)} title="Mark complete">
                                        <Check className="h-3.5 w-3.5 text-green-600" />
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(m)}>
                                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                    </Button>
                                  </div>
                                )}
                                </div>
                                </div>
                                </div>
                                );
                                });
                                })()}
                    </div>
                  </div>
                )}
              </div>
            )}
            {expanded && selectedAppForDetails !== app.id && (
              <div>
                <p className="px-4 py-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/20 transition" onClick={() => setSelectedAppForDetails(app.id)}>
                  Click above to view history and calendar
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Project Kick-off Meeting" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.milestone_type} onValueChange={v => setForm(f => ({ ...f, milestone_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MILESTONE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Assigned To (email)</Label>
                <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="email for reminders" />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe what needs to happen…" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes…" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.due_date}>
              {saving ? 'Saving…' : editingMilestone ? 'Save Changes' : 'Add Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}