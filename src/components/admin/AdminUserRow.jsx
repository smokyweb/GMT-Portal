import {Circle} from 'lucide-react';
import {Avatar,AvatarFallback,Checkbox} from './ui';
import RoleBadge from '@/components/RoleBadge';
import {accountInitials,accountActivity} from '@/lib/adminAccountData';
import UserActions from './UserActions';
export default function AdminUserRow({user,state}) {
  return <tr className={`border-b last:border-0 hover:bg-muted/20 ${user.active_status==='inactive'?'opacity-60':''}`}>
    <td className="p-3"><Checkbox aria-label={`Select ${user.email}`} checked={state.selected.has(user.id)} onCheckedChange={()=>state.toggle(user.id)}/></td>
    <td className="p-3 font-medium"><div className="flex items-center gap-2">
      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{accountInitials(user)}</AvatarFallback></Avatar>
      <span>{user.full_name||'—'}</span></div></td>
    <td className="p-3 text-muted-foreground">{user.email}</td><td className="p-3"><RoleBadge role={user.role}/></td>
    <td className="p-3 text-xs text-muted-foreground">{user.scope_state&&<span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold mr-1">{user.scope_state}</span>}
      {user.organization_name||(!user.scope_state&&'—')}</td>
    <td className="p-3 text-xs text-muted-foreground">{accountActivity(user)}</td>
    <td className="p-3"><div className="flex items-center gap-1.5"><Circle className={`h-2 w-2 ${user.active_status==='active'?'fill-green-500 text-green-500':'fill-slate-400 text-slate-400'}`}/>
      <span className={`text-xs font-medium ${user.active_status==='active'?'text-green-600':'text-slate-600'}`}>{user.active_status==='invited'?'Invited':user.active_status==='active'?'Active':'Inactive'}</span></div></td>
    <td className="p-3"><UserActions target={user} state={state}/></td>
  </tr>;
}
