import {useAdminAccounts} from '@/hooks/useAdminAccounts';
import AdminStats from '@/components/admin/AdminStats';
import InviteUserCard from '@/components/admin/InviteUserCard';
import AdminUsersTable from '@/components/admin/AdminUsersTable';
import EditAccountDialog from '@/components/admin/EditAccountDialog';
import PasswordResetDialog from '@/components/admin/PasswordResetDialog';
import DeleteAccountDialog from '@/components/admin/DeleteAccountDialog';
export default function AdminPanel() {
  const state=useAdminAccounts();
  if(state.loading)return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"/></div>;
  return <div className="space-y-6 max-w-6xl">
    <div><h1 className="text-2xl font-bold">User Management</h1><p className="text-muted-foreground text-sm mt-1">Manage users and roles.</p></div>
    {state.error&&!state.dialog&&<p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{state.error}</p>}
    {state.notice&&<p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{state.notice}</p>}
    <AdminStats stats={state.stats}/>
    <div className="space-y-4 mt-4"><InviteUserCard user={state.user} organizations={state.organizations} grantees={state.grantees} busy={state.busy} onInvite={state.invite} onImported={state.refresh}/>
      <AdminUsersTable state={state}/></div>
    {state.dialog?.type==='edit'&&<EditAccountDialog state={state}/>}
    {state.dialog?.type==='reset'&&<PasswordResetDialog user={state.dialog.user} busy={state.busy} error={state.error} onClose={state.closeDialog} onSubmit={state.reset} temporaryPassword={state.temporaryPassword}/>}
    {state.dialog?.type==='delete'&&<DeleteAccountDialog user={state.dialog.user} busy={state.busy} error={state.error} onClose={state.closeDialog} onSubmit={state.remove}/>}
  </div>;
}
