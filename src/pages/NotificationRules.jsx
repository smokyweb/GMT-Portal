import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Edit2 } from 'lucide-react';

const DEFAULT_RULES = [
  {
    name: 'Application Submitted',
    trigger: 'Application Submitted',
    recipients: ['admin', 'reviewer'],
    description: 'Notify state admins when a new application is submitted',
  },
  {
    name: 'Milestone Overdue',
    trigger: 'Milestone Due Date Passed',
    recipients: ['admin', 'reviewer'],
    description: 'Notify state admins when a milestone is overdue',
  },
  {
    name: 'Compliance Flag Created',
    trigger: 'Compliance Flag Created',
    recipients: ['admin'],
    description: 'Notify state admins when a compliance flag is opened',
  },
  {
    name: 'Document Uploaded',
    trigger: 'Document Uploaded',
    recipients: ['reviewer'],
    description: 'Notify reviewers when a document is uploaded',
  },
  {
    name: 'Funding Request Submitted',
    trigger: 'Funding Request Submitted',
    recipients: ['admin'],
    description: 'Notify state admins when a funding request is submitted',
  },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'State Admin' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'federal_admin', label: 'Federal Admin' },
  { value: 'user', label: 'Subrecipient' },
];

export default function NotificationRules() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      
      // Load rules from WorkflowRule entity (or use defaults)
      try {
        const savedRules = await base44.entities.WorkflowRule.list('-created_date', 100);
        if (savedRules.length > 0) {
          setRules(savedRules);
        } else {
          setRules(DEFAULT_RULES.map((r, i) => ({ id: `default-${i}`, ...r, enabled: true })));
        }
      } catch {
        setRules(DEFAULT_RULES.map((r, i) => ({ id: `default-${i}`, ...r, enabled: true })));
      }
      setLoading(false);
    });
  }, []);

  const handleToggle = async (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handleEdit = (rule) => {
    setEditingRule({ ...rule });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingRule) return;
    
    try {
      if (editingRule.id?.startsWith('default-')) {
        // Create new rule
        const newRule = await base44.entities.WorkflowRule.create({
          name: editingRule.name,
          trigger: editingRule.trigger,
          action_type: 'Send Email Notification',
          is_active: editingRule.enabled,
        });
        setRules(prev => [...prev.filter(r => !r.id.startsWith('default-') || r.id !== editingRule.id), { ...editingRule, id: newRule.id }]);
      } else {
        // Update existing
        await base44.entities.WorkflowRule.update(editingRule.id, {
          recipients: editingRule.recipients,
          is_active: editingRule.enabled,
        });
        setRules(prev => prev.map(r => r.id === editingRule.id ? editingRule : r));
      }
      setShowDialog(false);
      setEditingRule(null);
    } catch (err) {
      console.error('Error saving rule:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Notification Rules Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure which roles receive alerts for system events</p>
      </div>

      {/* Rules Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Rule Name</th>
                <th className="text-left p-3 font-medium">Trigger Event</th>
                <th className="text-left p-3 font-medium">Recipients</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-center p-3 font-medium">Enabled</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{rule.name}</td>
                  <td className="p-3 text-xs text-muted-foreground">{rule.trigger}</td>
                  <td className="p-3 text-xs">
                    <div className="flex gap-1 flex-wrap">
                      {rule.recipients?.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                          {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{rule.description}</td>
                  <td className="p-3 text-center">
                    <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule.id)} />
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(rule)}><Edit2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rule: {editingRule?.name}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-medium mb-2">Select Recipient Roles</p>
                <div className="space-y-2">
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
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Close</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}