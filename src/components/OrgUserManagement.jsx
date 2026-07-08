import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import RoleBadge from './RoleBadge';
import { UserPlus, MoreHorizontal, Trash2, Pencil, CheckCircle, KeyRound } from 'lucide-react';
import { formatDateShort } from '../lib/helpers';

export default function OrgUserManagement({ user, org }) {
  const [orgUsers, setOrgUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Edit
  const [editUser, setEditUser] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Password reset
  const [resetTarget, setResetTarget] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.User.list('-created_date', 200);
    setOrgUsers(all.filter(u => u.organization_id === user.organization_id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.organization_id]);


  const sendInviteEmail = async (email, tempPassword) => {
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Welcome to GMT Portal - Your Account Has Been Created',
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#0F1F3D">Welcome to GMT Portal</h2>
            <p>An account has been created for you on the Grant Management Tool (GMT) Portal.</p>
            <div style="background:#f4f4f8;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0"><strong>Login URL:</strong> <a href="https://gmt.bluesapps.com">gmt.bluesapps.com</a></p>
              <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
              <p style="margin:4px 0"><strong>Temporary Password:</strong> GMT_Welcome_2026!</p>
            </div>
            <p>Please log in and change your password as soon as possible.</p>
            <p style="color:#666;font-size:12px;margin-top:24px">If you did not expect this email, please contact your administrator.</p>
          </div>`,
        }),
      });
      if (res.ok) return true;
      const err = await res.json();
      console.warn('Email not sent:', err.message || err.error);
      return false;
    } catch (e) {
      console.warn('Email send failed:', e.message);
      return false;
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const tempPassword = 'GMT_Welcome_2026!';
      await base44.auth.register(inviteEmail, tempPassword, inviteEmail.split('@')[0], 'user').catch(async () => {
        await base44.entities.User.create({ email: inviteEmail, role: 'user', full_name: inviteEmail.split('@')[0] }).catch(() => {});
      });
      // Poll briefly to find the new user and set their org
      let attempts = 0;
      while (attempts < 5) {
        await new Promise(r => setTimeout(r, 1000));
        const all = await base44.entities.User.list('-created_date', 200);
        const newUser = all.find(u => u.email === inviteEmail);
        if (newUser) {
          await base44.entities.User.update(newUser.id, {
            organization_id: user.organization_id,
            organization_name: org?.name,
          });
          break;
        }
        attempts++;
      }
      const savedEmail = inviteEmail;
      await sendInviteEmail(savedEmail, 'GMT_Welcome_2026!');
      setInviteEmail('');
      setInviteSuccess(savedEmail);
      setTimeout(() => setInviteSuccess(false), 15000);
      load();
    } catch (err) {
      alert('Failed to invite user: ' + (err?.message || 'Please try again.'));
    } finally {
      setInviting(false);
    }
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    await base44.entities.User.update(editUser.id, { phone: editPhone });
    setEditSaving(false);
    setEditUser(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.User.delete(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const handlePasswordReset = async () => {
    setResetSending(true);
    await base44.integrations.Core.SendEmail({
      to: resetTarget.email,
      subject: 'GMT Portal - Password Reset Request',
      body: `Hello ${resetTarget.full_name || resetTarget.email},\n\nA team administrator has requested a password reset for your account.\n\nPlease visit the GMT Portal login page and use the "Forgot Password" option to reset your password.\n\nGMT Portal Team`,
    });
    setResetSending(false);
    setResetDone(true);
    setTimeout(() => { setResetTarget(null); setResetDone(false); }, 2000);
  };

  if (loading) return <div className="flex items-center justify-center p-10"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Invite */}
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Invite Team Member</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <Label className="text-xs">Email Address</Label>
            <Input
              className="mt-1"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
          </div>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
            {inviting ? 'Sending…' : 'Send Invite'}
          </Button>
          {inviteSuccess && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 mt-2">
              <p className="font-semibold flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Account created!</p>
              <p>Share these credentials with the new team member:</p>
              <p className="font-mono bg-white border rounded px-2 py-1">Email: {inviteSuccess}</p>
              <p className="font-mono bg-white border rounded px-2 py-1">Password: GMT_Welcome_2026!</p>
              <p className="text-green-600">They can log in at gmt.bluesapps.com and update their profile.</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Invited users will be added to your organization with subrecipient access.</p>
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Team Members ({orgUsers.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orgUsers.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{u.full_name || ' - '}</td>
                  <td className="p-3 text-muted-foreground text-xs">{u.email}</td>
                  <td className="p-3"><RoleBadge role={u.role} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{u.phone || ' - '}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateShort(u.created_date)}</td>
                  <td className="p-3">
                    {u.id !== user.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditUser(u); setEditPhone(u.phone || ''); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Contact Info
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(u)}>
                            <KeyRound className="h-3.5 w-3.5 mr-2" /> Send Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove from Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
              {orgUsers.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No team members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Contact Info</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">{editUser?.full_name || editUser?.email}</p>
            <div>
              <Label>Phone Number</Label>
              <Input className="mt-1" placeholder="(555) 123-4567" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={() => { setResetTarget(null); setResetDone(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send Password Reset</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {resetDone
              ? <span className="text-green-600 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Reset email sent to {resetTarget?.email}</span>
              : <>Send a password reset email to <strong>{resetTarget?.email}</strong>?</>}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetDone(false); }}>Close</Button>
            {!resetDone && <Button onClick={handlePasswordReset} disabled={resetSending}>{resetSending ? 'Sending…' : 'Send Reset'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Team Member</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Remove <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> from your organization? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />{deleting ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}