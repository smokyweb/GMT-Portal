import {Checkbox} from './ui';
import AdminUserRow from './AdminUserRow';
import AccountFilters from './AccountFilters';
import AccountBulkActions from './AccountBulkActions';
import AccountSortHeading from './AccountSortHeading';
export default function AdminUsersTable({state}) {
  return <section className="bg-card border rounded-xl overflow-hidden">
    <div className="p-3 border-b space-y-3"><AccountFilters state={state}/><AccountBulkActions state={state}/></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40">
      <th className="w-6 p-3"><Checkbox aria-label="Select all visible users" checked={Boolean(state.users.length)&&state.users.every(user=>state.selected.has(user.id))} onCheckedChange={state.selectAll}/></th>
      <AccountSortHeading column="name" label="Name" state={state}/><th className="text-left p-3 font-medium text-muted-foreground">Email</th>
      <AccountSortHeading column="role" label="Role" state={state}/><th className="text-left p-3 font-medium text-muted-foreground">State / Org</th>
      <AccountSortHeading column="activity" label="Last login" state={state}/><th className="text-left p-3 font-medium text-muted-foreground">Status</th>
      <th className="p-3 font-medium text-muted-foreground">Actions</th>
    </tr></thead><tbody>{state.users.map(user=><AdminUserRow key={user.id} user={user} state={state}/>)}
      {!state.users.length&&<tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No users found</td></tr>}
    </tbody></table></div>
  </section>;
}
