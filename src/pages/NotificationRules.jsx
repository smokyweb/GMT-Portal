import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const TRIGGER_OPTIONS = [
  'Application Submitted',
  'Application Approved',
  'Application Rejected',
  'Milestone Due Date Passed',
  'Milestone Completed',
  'Compliance Flag Created',
  'Compliance Flag Resolved',
  'Document Uploaded',
  'Document Approved',
  'Document Rejected',
  'Funding Request Submitted',
  'Funding Request Approved',
  'Funding Request Rejected',
  'Credit Issued',
  'User Registered',
  'Report Submitted',
];

const DELIVERY_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-App Notification' },
  { value: 'both', label: 'Email + In-App' },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'State Admin' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'federal_admin', label: 'Federal Admin' },
  { value: 'isc_admin', label: 'ISC Admin' },
  { value: 'user', label: 'Subrecipient' },
];

const BLANK_RULE = {
  name: '',
  trigger: '',
  recipients: [],
  description: '',
  delivery: 'both',
  enabled: true,
};

const DEFAULT_RULES = [
  { name: 'Application Submitted', trigger: 'Application Submitted', recipients: ['admin', 'reviewer'], description: 'Notify state admins when a new application is submitted', delivery: 'both', enabled: true },
  { name: 'Milestone Overdue', trigger: 'Milestone Due Date Passed', recipients: ['admin', 'reviewer'], description: 'Notify state admins when a milestone is overdue', delivery: 'both', enabled: true },
  { name: 'Compliance Flag Created', trigger: 'Compliance Flag Created', recipients: ['admin'], description: 'Notify state admins when a compliance flag is opened', delivery: 'both', enabled: true },
  { name: 'Document Uploaded', trigger: 'Document Uploaded', recipients: ['reviewer'], description: 'Notify reviewers when a document is uploaded', delivery: 'in_app', enabled: true },
  { name: 'Funding Request Submitted', trigger: 'Funding Request Submitted', recipients: ['admin'], description: 'Notify state admins when a funding request is submitted', delivery: 'both', enabled: true },
];

export default function NotificationRules() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      try {
        const savedRules = await base44.entities.WorkflowRule.list('-created_date', 100);
        if (savedRules && savedRules.length > 0) {
          setRules(savedRules.map(r => ({
            ...r,
            enabled: r.is_active !== false,
            recipients: r.recipients || [],
            delivery: r.delivery || 'both',
          })));
        } else {
          setRules(DEFAULT_RULES.map((r, i) => ({ id: `default-${i}`, ...r })));
        }
      } catch {
        setRules(DEFAULT_RULES.map((r, i) => ({ id: `default-${i}`, ...r })));
      }
      setLoading(false);
    });
  }, []);

  const validate = (rule) => {
    const errs = {};
    if (!rule.name?.trim()) errs.name = 'Rule name is required';
    if (!rule.trigger) errs.trigger = 'Trigger event is required';
    if (!rule.recipients || rule.recipients.length === 0) errs.recipients = 'At least one recipient role is required';
    if (!rule.delivery) errs.delivery = 'Delivery method is required';
    return errs;
  };

  const handleToggle = async (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    const rule = rules.find(r => r.id === ruleId);
    if (rule && !ruleId.startsWith('default-')) {
      try {
        await base44.entities.WorkflowRule.update(ruleId, { is_active: !rule.enabled });
      } catch { /* silently fail */ }
    }
  };

  const openNew = () => {
    setEditingRule({ ...BLANK_RULE });
    setIsNew(true);
    setErrors({});
    setShowDialog(true);
  };

  const openEdit = (rule) => {
    setEditingRule({ ...rule });
    setIsNew(false);
    setErrors({});
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    const errs = validate(editingRule);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        name: editingRule.name.trim(),
        trigger: editingRule.trigger,
        action_type: 'Send Notification',
        recipients: editingRule.recipients,
        description: editingRule.description || '',
        delivery: editingRule.delivery,
        is_active: editingRule.enabled !== false,
      };

      if (isNew || editingRule.id?.startsWith('default-')) {
        const created = await base44.entities.WorkflowRule.create(payload);
        setRules(prev => [
          ...prev.filter(r => r.id !== editingRule.id),
          { ...editingRule, ...payload, id: created.id, enabled: payload.is_active },
        ]);
        toast.success('Notification rule created');
      } else {
        await base44.entities.WorkflowRule.update(editingRule.id, payload);
        setRules(prev => prev.map(r => r.id === editingRule.id
          ? { ...editingRule, ...payload, enabled: payload.is_active }
          : r
        ));
        toast.success('Notification rule updated');
      }
      setShowDialog(false);
      setEditingRule(null);
    } catch (err) {
      toast.error('Failed to save rule — please try again');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      if (!rule.id.startsWith('default-')) {
        await base44.entities.WorkflowRule.delete(rule.id);
      }
      setRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingRule(null);
    setErrors({});
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure which roles receive alerts for system events</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </div>

      {/* Rules Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Rule Name</th>
                <th className="text-left p-3 font-medium">Trigger</th>
                <th className="text-left p-3 font-medium">Recipients</th>
                <th className="text-left p-3 font-medium">Delivery</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-center p-3 font-medium">Enabled</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No notification rules yet. Click "Add Rule" to create one.</td></tr>
              )}
              {rules.map(rule => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{rule.name}</td>
                  <td className="p-3 text-xs text-muted-foreground">{rule.trigger}</td>
                  <td className="p-3 text-xs">
                    <div className="flex gap-1 flex-wrap">
                      {(rule.recipients || []).map(r => (
                        <span key={r} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                          {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground capitalize">{rule.delivery?.replace('_', ' ') || 'both'}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate" title={rule.description}>{rule.description || '—'}</td>
                  <td className="p-3 text-center">
                    <Switch checked={rule.enabled !== false} onCheckedChange={() => handleToggle(rule.id)} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(rule)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="!left-auto !right-4 !translate-x-0 w-[calc(100vw-5rem)] max-w-lg max-h-[90vh] flex flex-col overflow-hidden sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%]">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Notification Rule' : `Edit Rule: ${editingRule?.name}`}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Rule Name */}
              <div>
                <Label>Rule Name <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Application Submitted Alert"
                  value={editingRule.name}
                  onChange={e => setEditingRule(r => ({ ...r, name: e.target.value }))}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Trigger Event */}
              <div>
                <Label>Trigger Event <span className="text-red-500">*</span></Label>
                <Select value={editingRule.trigger || '__none__'} onValueChange={v => setEditingRule(r => ({ ...r, trigger: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select trigger…" /></SelectTrigger>
                  <SelectContent className="max-h-56 overflow-y-auto">
                    <SelectItem value="__none__">Select trigger…</SelectItem>
                    {TRIGGER_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.trigger && <p className="text-xs text-red-500 mt-1">{errors.trigger}</p>}
              </div>

              {/* Delivery Method */}
              <div>
                <Label>Delivery Method <span className="text-red-500">*</span></Label>
                <Select value={editingRule.delivery || 'both'} onValueChange={v => setEditingRule(r => ({ ...r, delivery: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.delivery && <p className="text-xs text-red-500 mt-1">{errors.delivery}</p>}
              </div>

              {/* Recipients */}
              <div>
                <Label>Recipient Roles <span className="text-red-500">*</span></Label>
                <div className="mt-2 space-y-2 border rounded-lg p-3">
                  {ROLE_OPTIONS.map(role => (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingRule.recipients?.includes(role.value) || false}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditingRule(r => ({ ...r, recipients: [...(r.recipients || []), role.value] }));
                          } else {
                            setEditingRule(r => ({ ...r, recipients: (r.recipients || []).filter(x => x !== role.value) }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
                {errors.recipients && <p className="text-xs text-red-500 mt-1">{errors.recipients}</p>}
              </div>

              {/* Description */}
              <div>
                <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  placeholder="Describe what this rule does…"
                  value={editingRule.description || ''}
                  onChange={e => setEditingRule(r => ({ ...r, description: e.target.value }))}
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingRule.enabled !== false}
                  onCheckedChange={v => setEditingRule(r => ({ ...r, enabled: v }))}
                />
                <Label className="cursor-pointer">Rule enabled</Label>
              </div>
            </div>
          )}
          <DialogFooter className="pt-4 flex flex-row gap-2 justify-end flex-shrink-0">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={closeDialog}>Cancel</Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create Rule' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
