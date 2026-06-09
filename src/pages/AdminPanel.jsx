import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, ShieldCheck, UserPlus, RefreshCw, CheckCircle, Trash2, KeyRound, Pencil, MoreHorizontal, ArrowUp, ArrowDown, Edit3, Eye, Circle, Lock, Unlock, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import RoleBadge from '../components/RoleBadge';
import BulkUserUpload from '../components/BulkUserUpload';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { Checkbox } from '@/components/ui/checkbox';
import { ROLE_LABELS } from '../lib/permissions';

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [organizations, setOrganizations] = useState([]);
  const [grantees, setGrantees] = useState([]);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteScopeState, setInviteScopeState] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Edit user dialog
  const [editUser, setEditUser] = useState(null);
  const [editFields, setEditFields] = useState({ role: 'user', organization_id: '', scope_state: '', phone: '', active_status: 'active' });
  const [editSaving, setEditSaving] = useState(false);

  // Password reset
  const [resetTarget, setResetTarget] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Delete user
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk actions
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [searchUsers, setSearchUsers] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const [userList, orgList, granteeList] = await Promise.all([
        base44.entities.User.list('-created_date', 200),
        base44.entities.Organization.filter({ is_active: true }),
        base44.entities.Grantee.list('-created_date', 200),
      ]);
      setUsers(userList);
      setOrganizations(orgList);
      setGrantees(granteeList);
      setLoading(false);
    });
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
    // Create the user directly via our auth API (no email system in self-hosted mode)
    const tempPassword = 'GMT_Welcome_2026!';
    await base44.auth.register(inviteEmail, tempPassword, inviteEmail.split('@')[0], inviteRole).catch(async () => {
      // If register fails (user might exist), try creating via entity
      await base44.entities.User.create({ email: inviteEmail, role: inviteRole, full_name: inviteEmail.split('@')[0] }).catch(() => {});
    });
    // Poll briefly for the user record to appear, then set org/scope_state
    if (inviteOrgId || inviteScopeState) {
      const org = organizations.find(o => o.id === inviteOrgId);
      let attempts = 0;
      while (attempts < 5) {
        await new Promise(r => setTimeout(r, 1000));
        const userList = await base44.entities.User.list('-created_date', 200);
        const newUser = userList.find(u => u.email === inviteEmail);
        if (newUser) {
          const updates = {};
          if (inviteOrgId) { updates.organization_id = inviteOrgId; updates.organization_name = org?.name; }
          if (inviteScopeState) updates.scope_state = inviteScopeState;
          await base44.entities.User.update(newUser.id, updates);
          setUsers(userList.map(u => u.id === newUser.id ? { ...u, ...updates } : u));
          break;
        }
        attempts++;
      }
    }
    } catch (err) {
      console.error('Invite error:', err);
    } finally {
      setInviting(false);
    }
    setInviteSuccess(true);
    setInviteEmail('');
    setInviteOrgId('');
    setInviteScopeState('');
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  const handleEditUser = async () => {
    setEditSaving(true);
    try {
      const orgId = editFields.organization_id && editFields.organization_id !== '__none__' ? editFields.organization_id : null;
      const org = organizations.find(o => o.id === orgId);
      const updates = {
        role: editFields.role,
        phone: editFields.phone || null,
        active_status: editFields.active_status || 'active',
        organization_id: orgId,
        organization_name: org?.name || null,
        scope_state: editFields.scope_state || null,
      };
      await base44.entities.User.update(editUser.id, updates);
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u));
      setEditUser(null);
    } catch (err) {
      console.error('Edit user error:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedUsers.size === 0 || !bulkAction) return;
    setBulkProcessing(true);
    const userIds = Array.from(selectedUsers);
    
    for (const userId of userIds) {
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) continue;

      if (bulkAction === 'status') {
        await base44.entities.User.update(userId, { active_status: bulkValue });
      } else if (bulkAction === 'role') {
        await base44.entities.User.update(userId, { role: bulkValue });
      }
    }

    const updatedUsers = await base44.entities.User.list('-created_date', 200);
    setUsers(updatedUsers);
    setSelectedUsers(new Set());
    setBulkAction(null);
    setBulkValue('');
    setBulkProcessing(false);
  };

  const handlePasswordReset = async () => {
    setResetSending(true);
    await base44.integrations.Core.SendEmail({
      to: resetTarget.email,
      subject: 'GMT Portal â€“ Password Reset Request',
      body: `Hello ${resetTarget.full_name || resetTarget.email},\n\nAn administrator has requested a password reset for your account.\n\nPlease visit the GMT Portal login page and use the "Forgot Password" option to reset your password.\n\nIf you did not request this, please contact your administrator.\n\nGMT Portal Team`,
    });
    setResetSending(false);
    setResetDone(true);
    setTimeout(() => { setResetTarget(null); setResetDone(false); }, 2000);
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    await base44.entities.User.delete(deleteTarget.id);
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };



  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchUsers || u.full_name?.toLowerCase().includes(searchUsers.toLowerCase()) || u.email?.toLowerCase().includes(searchUsers.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.active_status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    let aVal, bVal;
    if (sortColumn === 'name') {
      aVal = (a.full_name || '').toLowerCase();
      bVal = (b.full_name || '').toLowerCase();
    } else if (sortColumn === 'role') {
      aVal = a.role || '';
      bVal = b.role || '';
    } else if (sortColumn === 'joined') {
      aVal = new Date(a.created_date) || new Date(0);
      bVal = new Date(b.created_date) || new Date(0);
    } else if (sortColumn === 'activity') {
      aVal = new Date(a.last_activity || a.created_date) || new Date(0);
      bVal = new Date(b.last_activity || b.created_date) || new Date(0);
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const stats = {
    totalUsers: users.length,
    adminUsers: users.filter(u => u.role === 'admin').length,
  };

  // no local label/badge needed â€” using RoleBadge component

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage users and roles.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Admin Users', value: stats.adminUsers, icon: ShieldCheck, color: 'bg-purple-50 text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 mt-4">
          {/* Invite user */}
           <div className="bg-card border rounded-xl p-4">
             <div className="flex items-center justify-between mb-3">
               <h2 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite New User</h2>
               <BulkUserUpload onSuccess={() => window.location.reload()} />
             </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <Label className="text-xs">Email Address</Label>
                <Input
                  className="mt-1"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div className="w-40">
                <Label className="text-xs">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Subrecipient</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">State Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* State scope â€” shown for state-level roles */}
              {['admin', 'reviewer'].includes(inviteRole) && (
                <div className="w-44">
                  <Label className="text-xs">State Scope</Label>
                  <Select value={inviteScopeState} onValueChange={setInviteScopeState}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select stateâ€¦" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {grantees.filter(g => g.is_active).map(g => (
                        <SelectItem key={g.id} value={g.state_code}>{g.state_code} â€” {g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Org â€” shown for subrecipient users */}
              {inviteRole === 'user' && (
                <div className="w-52">
                  <Label className="text-xs">Organization (optional)</Label>
                  <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {organizations.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="mb-0.5">
                {inviting ? 'Sendingâ€¦' : 'Send Invite'}
              </Button>
              {inviteSuccess && (
                <span className="text-xs text-green-600 flex items-center gap-1 mb-0.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Invite sent!
                </span>
              )}
            </div>
          </div>

          {/* User table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-3 border-b space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <Input
                  placeholder="Search by name or emailâ€¦"
                  value={searchUsers}
                  onChange={e => setSearchUsers(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="user">Subrecipient</SelectItem>
                    <SelectItem value="reviewer">State Reviewer</SelectItem>
                    <SelectItem value="admin">State Admin</SelectItem>
                    <SelectItem value="federal_officer">Federal Officer</SelectItem>
                    <SelectItem value="federal_admin">Federal Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto px-3 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                </div>
              </div>
              {selectedUsers.size > 0 && (
                <div className="flex gap-2 items-center p-2 bg-primary/5 rounded border border-primary/20">
                  <span className="text-xs font-medium text-primary">{selectedUsers.size} selected</span>
                  <Select value={bulkAction || ''} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-32 h-7"><SelectValue placeholder="Bulk action" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Change Status</SelectItem>
                      <SelectItem value="role">Change Role</SelectItem>
                    </SelectContent>
                  </Select>
                  {bulkAction === 'status' && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-32 h-7"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {bulkAction === 'role' && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-40 h-7"><SelectValue placeholder="Role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Subrecipient</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {bulkValue && (
                    <Button size="sm" className="h-7" onClick={handleBulkAction} disabled={bulkProcessing}>
                      {bulkProcessing ? 'Processingâ€¦' : 'Apply'}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => { setSelectedUsers(new Set()); setBulkAction(null); setBulkValue(''); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-6 p-3"><Checkbox checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length} onChange={e => setSelectedUsers(e.target.checked ? new Set(filteredUsers.map(u => u.id)) : new Set())} /></th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition">
                        Name
                        {sortColumn === 'name' && (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('role')} className="flex items-center gap-1 hover:text-foreground transition">
                        Role
                        {sortColumn === 'role' && (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">State / Org</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <button onClick={() => handleSort('activity')} className="flex items-center gap-1 hover:text-foreground transition text-xs">
                        <Clock className="h-3.5 w-3.5" /> Activity
                        {sortColumn === 'activity' && (sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                      </button>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/20 ${u.active_status === 'inactive' ? 'opacity-60' : ''}`}>
                      <td className="p-3"><Checkbox checked={selectedUsers.has(u.id)} onChange={e => { const newSet = new Set(selectedUsers); e.target.checked ? newSet.add(u.id) : newSet.delete(u.id); setSelectedUsers(newSet); }} /></td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || u.email?.[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{u.full_name || 'â€”'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3"><RoleBadge role={u.role} /></td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {u.scope_state && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold mr-1">{u.scope_state}</span>
                        )}
                        {u.organization_name || (!u.scope_state && 'â€”')}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(u.last_activity || u.created_date)}</td>
                      <td className="p-3 flex items-center gap-1.5">
                        {u.active_status === 'active' ? (
                          <>
                            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          </>
                        ) : (
                          <>
                            <Circle className="h-2 w-2 fill-slate-400 text-slate-400" />
                            <span className="text-xs text-slate-600 font-medium">Inactive</span>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => { setEditUser(u); setEditFields({ role: u.role || 'user', organization_id: u.organization_id || '', scope_state: u.scope_state || '', phone: u.phone || '', active_status: u.active_status || 'active' }); }}>
                              <Edit3 className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditUser(u); setEditFields({ role: u.role || 'user', organization_id: u.organization_id || '', scope_state: u.scope_state || '', phone: u.phone || '', active_status: u.active_status === 'active' ? 'inactive' : 'active' }); }}>
                              {u.active_status === 'active' ? <Lock className="h-3.5 w-3.5 mr-2" /> : <Unlock className="h-3.5 w-3.5 mr-2" />}
                              {u.active_status === 'active' ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            {u.id !== user?.id && (
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(u)}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{editUser?.full_name || 'â€”'}</p>
              <p className="text-xs text-muted-foreground">{editUser?.email}</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editFields.role} onValueChange={v => setEditFields(f => ({ ...f, role: v, scope_state: '', organization_id: '' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Subrecipient</SelectItem>
                  <SelectItem value="reviewer">State Reviewer</SelectItem>
                  <SelectItem value="admin">State Admin</SelectItem>
                  <SelectItem value="federal_officer">Federal Officer</SelectItem>
                  <SelectItem value="federal_admin">Federal Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* State scope for state-level roles */}
            {['admin', 'reviewer'].includes(editFields.role) && (
              <div>
                <Label>State Scope <span className="text-muted-foreground text-xs font-normal">(limits visibility to this state)</span></Label>
                <Select value={editFields.scope_state} onValueChange={v => setEditFields(f => ({ ...f, scope_state: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select stateâ€¦" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No restriction (federal-level access)</SelectItem>
                    {grantees.filter(g => g.is_active).map(g => (
                      <SelectItem key={g.id} value={g.state_code}>{g.state_code} â€” {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Organization for subrecipient users */}
            {editFields.role === 'user' && (
              <div>
                <Label>Organization</Label>
                <Select value={editFields.organization_id} onValueChange={v => setEditFields(f => ({ ...f, organization_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {organizations.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name} {o.state ? `(${o.state})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Phone Number</Label>
              <Input
                className="mt-1"
                placeholder="e.g. (555) 123-4567"
                value={editFields.phone}
                onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Account Status</Label>
              <Select value={editFields.active_status} onValueChange={v => setEditFields(f => ({ ...f, active_status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
            <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={() => { setResetTarget(null); setResetDone(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Password Reset</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            {resetDone ? (
              <p className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Reset email sent to <strong>{resetTarget?.email}</strong></p>
            ) : (
              <p>Send a password reset email to <strong>{resetTarget?.email}</strong>?</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetDone(false); }}>Close</Button>
            {!resetDone && (
              <Button onClick={handlePasswordReset} disabled={resetSending}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                {resetSending ? 'Sendingâ€¦' : 'Send Reset Email'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to remove <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {deleting ? 'Removingâ€¦' : 'Remove User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}