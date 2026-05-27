import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Zap, CheckCircle2, FileText, Flag, DollarSign, BarChart3, Play, Clock,
  Plus, Trash2, ToggleLeft, ToggleRight, Pencil, Copy, BookOpen, X, ChevronDown, ChevronUp,
  Settings, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WORKFLOW_RULES, RULE_TEMPLATES, onReportOverdue } from '../lib/workflowEngine';
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
  'Document Uploaded',
  'Application Status Changed',
  'Application Submitted',
  'Compliance Flag Created',
  'Compliance Flag Resolved',
  'Funding Request Submitted',
  'Funding Request Approved',
  'Funding Request Denied',
  'Funding Request Payment Initiated',
  'Report Submitted',
  'Report Due Date Passed',
  'Milestone Due Date Passed',
  'Expenditure Threshold Exceeded',
];

const ACTION_TYPES = [
  'Send Email Notification',
  'Send Email to Admins',
  'Send Email to Subrecipient',
  'Transition Application Status',
  'Create Compliance Flag',
  'Enable Multi-Step Payment Approval',
  'Set Funding Request Payment Status',
  'Create Milestone',
];

const TARGET_STATUSES = ['Draft', 'Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested', 'Approved', 'Denied'];
const PAYMENT_STATUSES = ['PendingDisbursement', 'SubmittedToFinance', 'PendingPMApproval', 'PendingFOApproval', 'Paid', 'PaymentFailed'];
const FLAG_TYPES = ['OverdueReport', 'MissingDocument', 'FinancialDiscrepancy', 'MatchShortfall'];
const FLAG_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

const EMPTY_FORM = {
  name: '', trigger: '', condition: '', action_type: '',
  action_detail: '', target_status: '', email_subject: '', email_body: '',
  condition_program: '', condition_amount: '', condition_severity: '',
  flag_type: '', flag_severity: '', payment_target_status: '',
};

const EMPTY_BUILTIN_OVERRIDE = { email_subject: '', email_body: '', condition: '', is_active: true };

export default function WorkflowRules() {
  const [recentLogs, setRecentLogs] = useState([]);
  const [customRules, setCustomRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [expandedBuiltIn, setExpandedBuiltIn] = useState(false);
  const [builtinOverrides, setBuiltinOverrides] = useState({});
  const [editingBuiltIn, setEditingBuiltIn] = useState(null); // the WORKFLOW_RULES item being edited
  const [builtinForm, setBuiltinForm] = useState(EMPTY_BUILTIN_OVERRIDE);
  const [savingBuiltin, setSavingBuiltin] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [logs, rules, u, settings] = await Promise.all([
      base44.entities.AuditLog.filter({ user_email: 'workflow-engine@system' }, '-created_date', 30),
      base44.entities.WorkflowRule.list('-created_date', 100),
      base44.auth.me(),
      base44.entities.AppSettings.filter({ key: 'builtin_rule_overrides' }),
    ]);
    setRecentLogs(logs);
    setCustomRules(rules);
    setUser(u);
    if (settings[0]?.value) setBuiltinOverrides(settings[0].value);
    setLoading(false);
  };

  const runOverdueCheck = async () => {
    setRunning(true);
    const today = moment().format('YYYY-MM-DD');
    const overdueSchedules = await base44.entities.ReportSchedule.filter({ status: 'Pending' });
    const overdue = overdueSchedules.filter(r => r.due_date < today);
    await Promise.all(overdue.map(r => onReportOverdue(base44, r)));
    const logs = await base44.entities.AuditLog.filter({ user_email: 'workflow-engine@system' }, '-created_date', 30);
    setRecentLogs(logs);
    setRunning(false);
    alert(`Overdue check complete. Processed ${overdue.length} overdue report(s).`);
  };

  const openNew = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name || '',
      trigger: rule.trigger || '',
      condition: rule.condition || '',
      action_type: rule.action_type || '',
      action_detail: rule.action_detail || '',
      target_status: rule.target_status || '',
      email_subject: rule.email_subject || '',
      email_body: rule.email_body || '',
      condition_program: rule.condition_program || '',
      condition_amount: rule.condition_amount || '',
      condition_severity: rule.condition_severity || '',
      flag_type: rule.flag_type || '',
      flag_severity: rule.flag_severity || '',
      payment_target_status: rule.payment_target_status || '',
    });
    setShowDialog(true);
  };

  const applyTemplate = async (template) => {
    setSaving(true);
    try {
      await base44.entities.WorkflowRule.create({
        ...template,
        is_active: true,
        created_by_name: user?.full_name || user?.email,
      });
      const rules = await base44.entities.WorkflowRule.list('-created_date', 100);
      setCustomRules(rules);
      setShowTemplates(false);
    } catch (err) {
      console.error('Failed to create workflow rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.trigger || !form.action_type) return;
    setSaving(true);
    try {
      const payload = { ...form, is_active: true, created_by_name: user?.full_name || user?.email };
      if (editingRule) {
        await base44.entities.WorkflowRule.update(editingRule.id, payload);
      } else {
        await base44.entities.WorkflowRule.create(payload);
      }
      setShowDialog(false);
      setForm(EMPTY_FORM);
      setEditingRule(null);
      const rules = await base44.entities.WorkflowRule.list('-created_date', 100);
      setCustomRules(rules);
    } catch (err) {
      console.error('Failed to save workflow rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    await base44.entities.WorkflowRule.update(rule.id, { is_active: !rule.is_active });
    setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  };

  const duplicateRule = async (rule) => {
    const { id, created_date, updated_date, ...rest } = rule;
    await base44.entities.WorkflowRule.create({ ...rest, name: `${rule.name} (Copy)`, is_active: false });
    const rules = await base44.entities.WorkflowRule.list('-created_date', 100);
    setCustomRules(rules);
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    await base44.entities.WorkflowRule.delete(rule.id);
    setCustomRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveBuiltinOverrides = async (overrides) => {
    const existing = await base44.entities.AppSettings.filter({ key: 'builtin_rule_overrides' });
    if (existing[0]) {
      await base44.entities.AppSettings.update(existing[0].id, { value: overrides, updated_by: user?.email });
    } else {
      await base44.entities.AppSettings.create({ key: 'builtin_rule_overrides', value: overrides, updated_by: user?.email });
    }
    setBuiltinOverrides(overrides);
  };

  const openEditBuiltIn = (rule) => {
    const override = builtinOverrides[rule.id] || {};
    setBuiltinForm({
      email_subject: override.email_subject || '',
      email_body: override.email_body || '',
      condition: override.condition ?? rule.condition,
      is_active: override.is_active !== undefined ? override.is_active : true,
    });
    setEditingBuiltIn(rule);
  };

  const saveBuiltinEdit = async () => {
    setSavingBuiltin(true);
    const updated = { ...builtinOverrides, [editingBuiltIn.id]: builtinForm };
    await saveBuiltinOverrides(updated);
    setSavingBuiltin(false);
    setEditingBuiltIn(null);
  };

  const toggleBuiltIn = async (rule) => {
    const current = builtinOverrides[rule.id]?.is_active;
    const newActive = current === false ? true : false; // default is active, so toggle off
    const updated = { ...builtinOverrides, [rule.id]: { ...(builtinOverrides[rule.id] || {}), is_active: newActive } };
    await saveBuiltinOverrides(updated);
  };

  const visibleBuiltIn = expandedBuiltIn ? WORKFLOW_RULES : WORKFLOW_RULES.slice(0, 4);

  const showEmailFields = ['Send Email Notification', 'Send Email to Admins', 'Send Email to Subrecipient'].includes(form.action_type);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Workflow Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated rules that trigger status transitions, notifications, and compliance actions
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runOverdueCheck} disabled={running} variant="outline">
            <Play className={`h-4 w-4 mr-1.5 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Running…' : 'Run Overdue Check'}
          </Button>
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            <BookOpen className="h-4 w-4 mr-1.5" /> Templates
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> New Rule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="custom">
        <TabsList>
          <TabsTrigger value="custom">Custom Rules ({customRules.length})</TabsTrigger>
          <TabsTrigger value="builtin">Built-in Rules ({WORKFLOW_RULES.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Custom Rules */}
        <TabsContent value="custom" className="space-y-3 mt-4">
          {customRules.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground text-sm space-y-3">
              <Zap className="h-8 w-8 mx-auto opacity-30" />
              <p>No custom rules yet.</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                  <BookOpen className="h-4 w-4 mr-1" /> Browse Templates
                </Button>
                <Button size="sm" onClick={openNew}>
                  <Plus className="h-4 w-4 mr-1" /> Create Rule
                </Button>
              </div>
            </div>
          ) : (
            customRules.map(rule => (
              <div key={rule.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition ${!rule.is_active ? 'opacity-50' : ''}`}>
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
                      <Button variant="ghost" size="sm" onClick={() => openEdit(rule)} title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicateRule(rule)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
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
                  {(rule.email_subject || rule.target_status || rule.payment_target_status) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rule.target_status && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">→ {rule.target_status}</span>}
                      {rule.payment_target_status && <span className="text-[10px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Payment → {rule.payment_target_status}</span>}
                      {rule.email_subject && <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border truncate max-w-[260px]">Subject: {rule.email_subject}</span>}
                    </div>
                  )}
                  {rule.created_by_name && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">Created by {rule.created_by_name} · {moment(rule.created_date).fromNow()}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Built-in Rules */}
        <TabsContent value="builtin" className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground">These rules run automatically in the app. You can disable or customize their email content and conditions using the edit button.</p>
          {visibleBuiltIn.map(rule => {
            const Icon = ENTITY_ICONS[rule.entity] || Zap;
            const colorClass = ENTITY_COLORS[rule.entity] || 'bg-slate-50 text-slate-700 border-slate-200';
            const override = builtinOverrides[rule.id] || {};
            const isActive = override.is_active !== false;
            const hasOverride = override.email_subject || override.email_body || (override.condition && override.condition !== rule.condition);
            return (
              <div key={rule.id} className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition ${!isActive ? 'opacity-50' : ''}`}>
                <div className={`flex-shrink-0 p-2 rounded-lg border ${colorClass}`}><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{rule.trigger}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {isActive ? <><CheckCircle2 className="h-3 w-3" /> Active</> : 'Disabled'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>{rule.entity}</span>
                      {hasOverride && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium flex items-center gap-1"><Settings className="h-2.5 w-2.5" /> Customized</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditBuiltIn(rule)} title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleBuiltIn(rule)} title={isActive ? 'Disable' : 'Enable'}>
                        {isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Condition</p>
                      <p className="text-xs">{override.condition || rule.condition}</p>
                    </div>
                    <div className="bg-primary/5 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-primary/70 uppercase mb-0.5">Action</p>
                      <p className="text-xs">{rule.action}</p>
                    </div>
                  </div>
                  {override.email_subject && (
                    <div className="mt-2 text-[10px] text-muted-foreground px-1">
                      Custom subject: <span className="text-foreground font-medium">{override.email_subject}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {WORKFLOW_RULES.length > 4 && (
            <button
              className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 py-2 hover:text-foreground transition"
              onClick={() => setExpandedBuiltIn(v => !v)}
            >
              {expandedBuiltIn ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all {WORKFLOW_RULES.length} rules</>}
            </button>
          )}
        </TabsContent>

        {/* Recent Activity */}
        <TabsContent value="activity" className="mt-4">
          <div className="bg-card border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
            ) : recentLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No workflow activity yet. Run the overdue check to get started.
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
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium whitespace-nowrap">{log.action}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">{log.description}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{moment(log.created_date).fromNow()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Rule Templates</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Click "Add" to instantly create a custom rule from a template. You can edit it afterwards.</p>
          <div className="space-y-3 mt-2">
            {RULE_TEMPLATES.map((t, i) => (
              <div key={i} className="border rounded-xl p-4 flex items-start gap-4 bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 font-medium">{t.trigger}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-medium">{t.action_type}</span>
                  </div>
                  {t.condition && <p className="text-xs text-muted-foreground mt-1.5">Condition: {t.condition}</p>}
                  {t.email_subject && <p className="text-xs text-muted-foreground mt-0.5">Subject: {t.email_subject}</p>}
                </div>
                <Button size="sm" disabled={saving} onClick={() => applyTemplate(t)}>Add</Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplates(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Built-in Rule Dialog */}
      <Dialog open={!!editingBuiltIn} onOpenChange={v => { if (!v) setEditingBuiltIn(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" /> Customize Built-in Rule
            </DialogTitle>
          </DialogHeader>
          {editingBuiltIn && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-sm">{editingBuiltIn.trigger}</p>
                <p className="text-muted-foreground">Default action: {editingBuiltIn.action}</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Rule Enabled</p>
                  <p className="text-xs text-muted-foreground">Disable to prevent this rule from executing</p>
                </div>
                <button onClick={() => setBuiltinForm(f => ({ ...f, is_active: !f.is_active }))}>
                  {builtinForm.is_active
                    ? <ToggleRight className="h-6 w-6 text-green-600" />
                    : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                </button>
              </div>

              <div>
                <Label>Override Condition Description <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input
                  className="mt-1"
                  value={builtinForm.condition}
                  onChange={e => setBuiltinForm(f => ({ ...f, condition: e.target.value }))}
                  placeholder={editingBuiltIn.condition}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Default: {editingBuiltIn.condition}</p>
              </div>

              <div className="space-y-3 rounded-lg border p-3 bg-muted/10">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Lock className="h-3 w-3" /> Custom Email Override
                </div>
                <p className="text-xs text-muted-foreground -mt-1">If set, these override the default email sent by this rule.</p>
                <div>
                  <Label className="text-xs">Email Subject</Label>
                  <Input
                    className="mt-1"
                    value={builtinForm.email_subject}
                    onChange={e => setBuiltinForm(f => ({ ...f, email_subject: e.target.value }))}
                    placeholder="Leave blank to use the default subject"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email Body</Label>
                  <Textarea
                    className="mt-1"
                    rows={4}
                    value={builtinForm.email_body}
                    onChange={e => setBuiltinForm(f => ({ ...f, email_body: e.target.value }))}
                    placeholder="Leave blank to use the default email body"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditingBuiltIn(null)}>Cancel</Button>
            <Button onClick={saveBuiltinEdit} disabled={savingBuiltin}>
              {savingBuiltin ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setForm(EMPTY_FORM); setEditingRule(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {editingRule ? 'Edit Workflow Rule' : 'New Workflow Rule'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Notify on Large Funding Request" />
            </div>

            {/* Trigger */}
            <div>
              <Label>Trigger <span className="text-red-500">*</span></Label>
              <Select value={form.trigger} onValueChange={v => set('trigger', v)}>
                <SelectTrigger><SelectValue placeholder="Select a trigger event…" /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Condition fields */}
            <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conditions (optional)</p>
              <div>
                <Label className="text-xs">Description / Notes</Label>
                <Input value={form.condition} onChange={e => set('condition', e.target.value)} placeholder="e.g. Only for SHSP program grants" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Program Code Filter</Label>
                  <Input value={form.condition_program} onChange={e => set('condition_program', e.target.value)} placeholder="e.g. SHSP, UASI" />
                </div>
                <div>
                  <Label className="text-xs">Amount Threshold ($)</Label>
                  <Input type="number" value={form.condition_amount} onChange={e => set('condition_amount', e.target.value)} placeholder="e.g. 50000" />
                </div>
              </div>
            </div>

            {/* Action */}
            <div>
              <Label>Action Type <span className="text-red-500">*</span></Label>
              <Select value={form.action_type} onValueChange={v => set('action_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select an action…" /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Action-specific fields */}
            {form.action_type === 'Transition Application Status' && (
              <div>
                <Label>Target Status</Label>
                <Select value={form.target_status} onValueChange={v => set('target_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select target status…" /></SelectTrigger>
                  <SelectContent>{TARGET_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.action_type === 'Set Funding Request Payment Status' && (
              <div>
                <Label>Target Payment Status</Label>
                <Select value={form.payment_target_status} onValueChange={v => set('payment_target_status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select payment status…" /></SelectTrigger>
                  <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.action_type === 'Create Compliance Flag' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Flag Type</Label>
                  <Select value={form.flag_type} onValueChange={v => set('flag_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Flag type…" /></SelectTrigger>
                    <SelectContent>{FLAG_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select value={form.flag_severity} onValueChange={v => set('flag_severity', v)}>
                    <SelectTrigger><SelectValue placeholder="Severity…" /></SelectTrigger>
                    <SelectContent>{FLAG_SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Flag Description</Label>
                  <Input value={form.action_detail} onChange={e => set('action_detail', e.target.value)} placeholder="Describe the compliance issue…" />
                </div>
              </div>
            )}

            {form.action_type === 'Enable Multi-Step Payment Approval' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">Multi-Step Payment Approval</p>
                <p>When this rule fires, the funding request will require approval from a <strong>Program Manager</strong> then a <strong>Finance Officer</strong> before payment can be marked Paid.</p>
              </div>
            )}

            {form.action_type === 'Create Milestone' && (
              <div>
                <Label>Milestone Title</Label>
                <Input value={form.action_detail} onChange={e => set('action_detail', e.target.value)} placeholder="e.g. Closeout Review" />
              </div>
            )}

            {!['Transition Application Status', 'Set Funding Request Payment Status', 'Create Compliance Flag', 'Enable Multi-Step Payment Approval', 'Create Milestone'].includes(form.action_type) && form.action_type && (
              <div>
                <Label>Action Details <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input value={form.action_detail} onChange={e => set('action_detail', e.target.value)} placeholder="Additional context for this action…" />
              </div>
            )}

            {showEmailFields && (
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
            <Button variant="outline" onClick={() => { setShowDialog(false); setForm(EMPTY_FORM); setEditingRule(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.trigger || !form.action_type}>
              {saving ? 'Saving…' : editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}