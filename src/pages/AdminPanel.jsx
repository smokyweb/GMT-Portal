import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ClipboardList, ShieldCheck, UserPlus, RefreshCw, CheckCircle, Trash2, KeyRound, Pencil, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency, formatDateShort } from '../lib/helpers';

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Edit user dialog
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editSaving, setEditSaving] = useState(false);

  // Password reset
  const [resetTarget, setResetTarget] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Delete user
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [appFilter, setAppFilter] = useState('all');
  const [searchUsers, setSearchUsers] = useState('');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const [userList, appList] = await Promise.all([
        base44.entities.User.list('-created_date', 200),
        base44.entities.Application.list('-created_date', 200),
      ]);
      setUsers(userList);
      setApplications(appList);
      setLoading(false);
    });
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setInviteSuccess(true);
    setInviteEmail('');
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  const handleEditRole = async () => {
    setEditSaving(true);
    await base44.entities.User.update(editUser.id, { role: editRole });
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, role: editRole } : u));
    setEditSaving(false);
    setEditUser(null);
  };

  const handlePasswordReset = async () => {
    setResetSending(true);
    await base44.integrations.Core.SendEmail({
      to: resetTarget.email,
      subject: 'GMT Portal – Password Reset Request',
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

  const handleStatusChange = async (app, status) => {
    await base44.entities.Application.update(app.id, { status });
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status } : a));
    const emailMap = {
      Approved: {
        subject: `Application Approved – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has been APPROVED.\n\nPlease log in to the GMT Portal to view the details and next steps.\n\nGrant Management Team`,
      },
      Denied: {
        subject: `Application Not Approved – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nYour grant application (${app.application_number}) has not been approved at this time.\n\nPlease log in to the GMT Portal for more information.\n\nGrant Management Team`,
      },
      RevisionRequested: {
        subject: `Revision Requested – ${app.application_number}`,
        body: `Dear ${app.organization_name},\n\nRevisions are required for your grant application (${app.application_number}).\n\nPlease log in to the GMT Portal to review the feedback and update your application.\n\nGrant Management Team`,
      },
    };
    if (emailMap[status] && app.submitted_by) {
      await base44.integrations.Core.SendEmail({ to: app.submitted_by, ...emailMap[status] });
    }
  };

  const filteredApps = applications.filter(a =>
    appFilter === 'all' ? true : a.status === appFilter
  );

  const filteredUsers = users.filter(u =>
    !searchUsers || u.full_name?.toLowerCase().includes(searchUsers.toLowerCase()) || u.email?.toLowerCase().includes(searchUsers.toLowerCase())
  );

  const stats = {
    totalUsers: users.length,
    adminUsers: users.filter(u => u.role === 'admin').length,
    totalApps: applications.length,
    pendingApps: applications.filter(a => a.status === 'Submitted' || a.status === 'UnderReview').length,
  };

  const roleLabel = (role) => role === 'admin' ? 'State Admin' : role === 'reviewer' ? 'Reviewer' : 'Subrecipient';
  const roleBadge = (role) => role === 'admin' ? 'bg-purple-50 text-purple-700' : role === 'reviewer' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage users, roles, and applications.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Admin Users', value: stats.adminUsers, icon: ShieldCheck, color: 'bg-purple-50 text-purple-600' },
          { label: 'Total Applications', value: stats.totalApps, icon: ClipboardList, color: 'bg-green-50 text-green-600' },
          { label: 'Pending Review', value: stats.pendingApps, icon: RefreshCw, color: 'bg-amber-50 text-amber-600' },
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

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4 mt-4">
          {/* Invite user */}
          <div className="bg-card border rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite New User</h2>
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
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="mb-0.5">
                {inviting ? 'Sending…' : 'Send Invite'}
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
            <div className="p-3 border-b">
              <Input
                placeholder="Search by name or email…"
                value={searchUsers}
                onChange={e => setSearchUsers(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
                    <th className="p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{u.full_name || '—'}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDateShort(u.created_date)}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditUser(u); setEditRole(u.role || 'user'); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setResetTarget(u)}>
                              <KeyRound className="h-3.5 w-3.5 mr-2" /> Send Password Reset
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
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* APPLICATIONS TAB */}
        <TabsContent value="applications" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="UnderReview">Under Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Denied">Denied</SelectItem>
                <SelectItem value="RevisionRequested">Revision Requested</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filteredApps.length} applications</span>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="p-3 font-medium text-muted-foreground">Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map(app => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                      <td className="p-3 font-medium">{app.organization_name || '—'}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{app.program_code || '—'}</span></td>
                      <td className="p-3 text-right">{formatCurrency(app.requested_amount)}</td>
                      <td className="p-3"><StatusBadge status={app.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                      <td className="p-3">
                        <Select value={app.status} onValueChange={v => handleStatusChange(app, v)}>
                          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied'].map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                  {filteredApps.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No applications found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Change Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{editUser?.full_name || editUser?.email}</p>
            <div>
              <Label>New Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Subrecipient</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">State Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditRole} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Button>
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
                {resetSending ? 'Sending…' : 'Send Reset Email'}
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
              {deleting ? 'Removing…' : 'Remove User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}