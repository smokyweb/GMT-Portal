import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Zap, CheckCircle2, FileText, Flag, DollarSign, BarChart3, Play, Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { WORKFLOW_RULES, onReportOverdue } from '../lib/workflowEngine';
import moment from 'moment';

const ENTITY_ICONS = {
  Document: FileText, ComplianceFlag: Flag, FundingRequest: DollarSign, ReportSchedule: BarChart3,
};
const ENTITY_COLORS = {
  Document: 'bg-blue-50 text-blue-700 border-blue-200',
  ComplianceFlag: 'bg-red-50 text-red-700 border-red-200',
  FundingRequest: 'bg-green-50 text-green-700 border-green-200',
  ReportSchedule: 'bg-purple-50 text-purple-700 border-purple-200',
};

const TRIGGERS = [
  'Document Uploaded', 'Application Status Changed', 'Compliance Flag Created',
  'Compliance Flag Resolved', 'Funding Request Submitted', 'Funding Request Approved',
  'Report Due Date Passed', 'Milestone Due Date Passed', 'Application Submitted',
];
const ACTION_TYPES = [
  'Send Email Notification', 'Transition Application Status',
  'Create Compliance Flag', 'Send Email to Admins', 'Send Email to Subrecipient',
];
const TARGET_STATUSES = ['Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied'];

const EMPTY_FORM = {
  name: '', trigger: '', condition: '', action_type: '',
  action_detail: '', target_status: '', email_subject: '', email_body: '',
};

export default function WorkflowRules() {
  const [recentLogs, setRecentLogs] = useState([]);
  const [customRules, setCustomRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [logs, rules, u] = await Promise.all([
      base44.entities.AuditLog.filter({ user_email: 'workflow-engine@system' }, '-created_date', 20),
      base44.entities.WorkflowRule.list('-created_date', 100),
      base44.auth.me(),
    ]);
    setRecentLogs(logs);
    setCustomRules(rules);
    setUser(u);
    setLoading(false);
  };

  const runOverdueCheck = async () => {
    setRunning(true);
    const today = moment().format('YYYY-MM-DD');
    const overdueSchedules = await base44.entities.ReportSchedule.filter({ status: 'Pending' });
    const overdue = overdueSchedules.filter(r => r.due_date < today);
    await Promise.all(overdue.map(r => onReportOverdue(base44, r)));
    const logs = await base44.entities.AuditLog.filter({ user_email: 'workflow-engine@system' }, '-created_date', 20);
    setRecentLogs(logs);
    setRunning(false);
    alert(`Overdue check complete. Processed ${overdue.length} overdue report(s).`);
  };

  const handleSave = async () => {
    if (!form.name || !form.trigger || !form.action_type) return;
    setSaving(true);
    await base44.entities.WorkflowRule.create({
      ...form,
      is_active: true,
      created_by_name: user?.full_name || user?.email,
    });
    setShowDialog(false);
    setForm(EMPTY_FORM);
    const rules = await base44.entities.WorkflowRule.list('-created_date', 100);
    setCustomRules(rules);
    setSaving(false);
  };

  const toggleActive = async (rule) => {
    await base44.entities.WorkflowRule.update(rule.id, { is_active: !rule.is_active });
    setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    await base44.entities.WorkflowRule.delete(rule.id);
    setCustomRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Workflow Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Automated rules that trigger status transitions and email notifications</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runOverdueCheck} disabled={running} variant="outline">
            <Play className={`h-4 w-4 mr-1.5 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Running…' : 'Run Overdue Check'}
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Rule
          </Button>
        </div>
      </div>

      {/* Built-in Rules */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Built-in Rules ({WORKFLOW_RULES.length})
        </h2>
        {WORKFLOW_RULES.map(rule => {
          const Icon = ENTITY_ICONS[rule.entity] || Zap;
          const colorClass = ENTITY_COLORS[rule.entity] || 'bg-slate-50 text-slate-700 border-slate-200';
          return (
            <div key={rule.id} className="bg-card border rounded-xl p-4 flex items-start gap-4">
              <div className={`flex-shrink-0 p-2 rounded-lg border ${colorClass}`}><Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{rule.trigger}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>{rule.entity}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-muted/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Condition</p>
                    <p className="text-xs">{rule.condition}</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-primary/70 uppercase mb-0.5">Action</p>
                    <p className="text-xs">{rule.action}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Rules */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Custom Rules ({customRules.length})
        </h2>
        {customRules.length === 0 ? (
          <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-sm">
            No custom rules yet. Click <strong>New Rule</strong> to create one.
          </div>
        ) : (
          customRules.map(rule => (
            <div key={rule.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 ${!rule.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-shrink-0 p-2 rounded-lg border bg-slate-50 text-slate-700 border-slate-200">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{rule.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {rule.is_active ? <><CheckCircle2 className="h-3 w-3" /> Active</> : 'Inactive'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 font-medium">{rule.trigger}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(rule)} title={rule.is_active ? 'Disable' : 'Enable'}>
                      {rule.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteRule(rule)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rule.condition && (
                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Condition</p>
                      <p className="text-xs">{rule.condition}</p>
                    </div>
                  )}
                  <div className="bg-primary/5 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold text-primary/70 uppercase mb-0.5">Action</p>
                    <p className="text-xs">{rule.action_type}{rule.action_detail ? `: ${rule.action_detail}` : ''}</p>
                  </div>
                </div>
                {(rule.email_subject || rule.target_status) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.target_status && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">→ {rule.target_status}</span>
                    )}
                    {rule.email_subject && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border truncate max-w-[260px]">Subject: {rule.email_subject}</span>
                    )}
                  </div>
                )}
                {rule.created_by_name && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">Created by {rule.created_by_name} · {moment(rule.created_date).fromNow()}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Recent Workflow Activity</h2>
        <div className="bg-card border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : recentLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No workflow activity yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(log => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{log.action}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{log.description}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{moment(log.created_date).fromNow()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> New Workflow Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Notify on Application Submission" />
            </div>
            <div>
              <Label>Trigger <span className="text-red-500">*</span></Label>
              <Select value={form.trigger} onValueChange={v => set('trigger', v)}>
                <SelectTrigger><SelectValue placeholder="Select a trigger event…" /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition <span className="text-muted-foreground font-normal text-xs">(optional — describe when this fires)</span></Label>
              <Input value={form.condition} onChange={e => set('condition', e.target.value)} placeholder="e.g. Application status is 'Submitted'" />
            </div>
            <div>
              <Label>Action Type <span className="text-red-500">*</span></Label>
              <Select value={form.action_type} onValueChange={v => set('action_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select an action…" /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action Details <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input value={form.action_detail} onChange={e => set('action_detail', e.target.value)} placeholder="e.g. Flag as High severity, or details of the action" />
            </div>
            {form.action_type === 'Transition Application Status' && (
              <div>
                <Label>Target Status</Label>
                <Select value={form.target_status} onValueChange={v => set('target_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select target status…" /></SelectTrigger>
                  <SelectContent>
                    {TARGET_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.action_type === 'Send Email Notification' ||
              form.action_type === 'Send Email to Admins' ||
              form.action_type === 'Send Email to Subrecipient') && (
              <>
                <div>
                  <Label>Email Subject</Label>
                  <Input value={form.email_subject} onChange={e => set('email_subject', e.target.value)} placeholder="e.g. Action Required: Application Update" />
                </div>
                <div>
                  <Label>Email Body</Label>
                  <Textarea value={form.email_body} onChange={e => set('email_body', e.target.value)} rows={4} placeholder="Write the email message…" />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setShowDialog(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.trigger || !form.action_type}>
              {saving ? 'Saving…' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}