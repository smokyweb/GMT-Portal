import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle2, Circle, AlertCircle, Plus } from 'lucide-react';

// Format date string to readable format (handles both YYYY-MM-DD and ISO strings)
const formatMilestoneDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};
const MILESTONE_TYPES = [
  'ProjectKickoff',
  'MidTermReview',
  'FinalReport',
  'BudgetReview',
  'SiteVisit',
  'QuarterlyCheck',
  'CloseOut',
  'Custom',
];

const STATUSES = ['Upcoming', 'InProgress', 'Completed', 'Overdue', 'Waived'];

const STATUS_CONFIG = {
  Upcoming: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Circle },
  InProgress: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
  Completed: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
  Overdue: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
  Waived: { bg: 'bg-slate-50', text: 'text-slate-700', icon: Circle },
};

export default function MilestoneTracker() {
  const [milestones, setMilestones] = useState([]);
  const [applications, setApplications] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Filters
  const [filterOrg, setFilterOrg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    milestone_type: 'Custom',
    status: 'Upcoming',
    due_date: '',
    completed_date: '',
    application_id: '',
    assigned_to: '',
    notes: '',
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        const isSubrecipient = currentUser.role === 'user';

        let milestonesData, appsData, orgsData;

        if (isSubrecipient && currentUser.organization_id) {
          // Scope to this org's applications only
          appsData = await base44.entities.Application.filter({ organization_id: currentUser.organization_id });
          const appIds = new Set((appsData || []).map(a => a.id));
          const allMilestones = await base44.entities.Milestone.list();
          milestonesData = (allMilestones || []).filter(m => appIds.has(m.application_id));
          orgsData = [];
        } else {
          milestonesData = await base44.entities.Milestone.list();
          appsData = await base44.entities.Application.list();
          orgsData = await base44.entities.Organization.list();
        }

        setMilestones(milestonesData || []);
        setApplications(appsData || []);
        setOrganizations(orgsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter milestones
  const filteredMilestones = milestones.filter((m) => {
    if (filterOrg && m.organization_id !== filterOrg) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterType && m.milestone_type !== filterType) return false;
    return true;
  });

  // Group by application
  const groupedByApp = {};
  filteredMilestones.forEach((m) => {
    if (!groupedByApp[m.application_id]) {
      groupedByApp[m.application_id] = [];
    }
    groupedByApp[m.application_id].push(m);
  });

  // Handle save
  const handleSave = async () => {
    if (!form.title || !form.due_date || !form.application_id) {
      return;
    }

    try {
      setSaving(true);
      const selectedApp = applications.find(a => a.id === form.application_id);
      const payload = {
        ...form,
        organization_id: selectedApp?.organization_id || form.organization_id,
        organization_name: selectedApp?.organization_name || form.organization_name,
        application_number: selectedApp?.application_number || form.application_number,
        program_code: selectedApp?.program_code || form.program_code,
      };
      if (editingMilestone) {
        await base44.entities.Milestone.update(editingMilestone.id, payload);
      } else {
        await base44.entities.Milestone.create(payload);
      }

      // Reload milestones (scoped for subrecipients)
      const isSubrecipient = user?.role === 'user';
      let updated;
      if (isSubrecipient && user?.organization_id) {
        const all = await base44.entities.Milestone.list();
        const appIds = new Set(applications.map(a => a.id));
        updated = (all || []).filter(m => appIds.has(m.application_id));
      } else {
        updated = await base44.entities.Milestone.list();
      }
      setMilestones(updated || []);
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Error saving milestone:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle mark complete
  const handleMarkComplete = async (milestone) => {
    try {
      await base44.entities.Milestone.update(milestone.id, {
        ...milestone,
        status: 'Completed',
        completed_date: new Date().toISOString().split('T')[0],
      });

      const isSubrecipient = user?.role === 'user';
      let updated;
      if (isSubrecipient && user?.organization_id) {
        const all = await base44.entities.Milestone.list();
        const appIds = new Set(applications.map(a => a.id));
        updated = (all || []).filter(m => appIds.has(m.application_id));
      } else {
        updated = await base44.entities.Milestone.list();
      }
      setMilestones(updated || []);
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      milestone_type: 'Custom',
      status: 'Upcoming',
      due_date: '',
      completed_date: '',
      application_id: '',
      assigned_to: '',
      notes: '',
    });
    setEditingMilestone(null);
  };

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone);
    setForm(milestone);
    setShowForm(true);
  };

  const handleOpenForm = () => {
    resetForm();
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Milestones</h1>
            <p className="text-muted-foreground mt-1">Track project milestones and deliverables</p>
          </div>
          <Button onClick={handleOpenForm} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Milestone
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {user?.role !== 'user' && (
              <div>
                <Label className="text-xs font-medium mb-2 block">Organization</Label>
                <Select value={filterOrg} onValueChange={setFilterOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs font-medium mb-2 block">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Statuses</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-2 block">Milestone Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Types</SelectItem>
                  {MILESTONE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/([A-Z])/g, ' $1').trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Milestones List */}
        {Object.keys(groupedByApp).length === 0 ? (
          <div className="bg-card rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No milestones found</p>
            <Button variant="outline" onClick={handleOpenForm} className="mt-4">
              Create your first milestone
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByApp).map(([appId, appMilestones]) => {
              const app = applications.find((a) => a.id === appId);
              return (
                <div key={appId} className="bg-card rounded-lg border overflow-hidden">
                  {/* Application header */}
                  <div className="bg-muted/50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-foreground">
                      {app?.project_title || 'Unknown Application'} ({app?.application_number})
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{app?.organization_name}</p>
                  </div>

                  {/* Milestones table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/30 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Milestone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Due Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Completed
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {appMilestones.map((milestone) => {
                          const config = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.Upcoming;
                          const IconComponent = config.icon;
                          return (
                            <tr key={milestone.id} className="hover:bg-muted/30 transition">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-foreground">{milestone.title}</p>
                                  {milestone.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {milestone.description}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">
                                {(milestone.milestone_type || 'Custom').replace(/([A-Z])/g, ' $1').trim()}
                              </td>
                              <td className="px-6 py-4">
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
                                  <IconComponent className="w-4 h-4" />
                                  {milestone.status}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">
                                {formatMilestoneDate(milestone.due_date)}
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">
                                {formatMilestoneDate(milestone.completed_date)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {milestone.status !== 'Completed' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMarkComplete(milestone)}
                                    >
                                      Mark Complete
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(milestone)}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="!left-auto !right-4 !translate-x-0 w-[calc(100vw-5rem)] max-w-md max-h-[90vh] flex flex-col overflow-hidden sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%]">
            <DialogHeader>
              <DialogTitle>
                {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <Label>Application</Label>
                <Select
                  value={form.application_id}
                  onValueChange={(v) => setForm({ ...form, application_id: v })}
                >
                  <SelectTrigger className="truncate" title={form.application_id ? applications.find(a => a.id === form.application_id)?.project_title : ""}>
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {applications.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.project_title} ({app.application_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Project Kickoff Meeting"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={form.milestone_type}
                  onValueChange={(v) => setForm({ ...form, milestone_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MILESTONE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/([A-Z])/g, ' $1').trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Completed Date</Label>
                  <Input
                    type="date"
                    value={form.completed_date}
                    onChange={(e) => setForm({ ...form, completed_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <Label>Assigned To (email)</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <DialogFooter className="pt-4 flex flex-row gap-2 justify-end">
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleSave}
                disabled={saving || !form.title || !form.due_date}
              >
                {saving ? 'Saving...' : editingMilestone ? 'Save Changes' : 'Add Milestone'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}