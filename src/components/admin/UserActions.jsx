import {MoreHorizontal,Edit3,KeyRound,Mail,Trash2,Lock,Unlock} from 'lucide-react';
import {Button,DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from './ui';
export default function UserActions({target,state}) {
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button disabled={state.busy} variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${target.email}`}><MoreHorizontal className="h-4 w-4"/></Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem onClick={()=>state.setDialog({type:'edit',user:target})}><Edit3 className="h-3.5 w-3.5 mr-2"/>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={()=>state.setStatus(target)}>{target.active_status==='active'?<Lock className="h-3.5 w-3.5 mr-2"/>:<Unlock className="h-3.5 w-3.5 mr-2"/>}
      {target.active_status==='active'?'Deactivate':'Activate'}</DropdownMenuItem>
    <DropdownMenuItem onClick={()=>state.setDialog({type:'reset',user:target})}><KeyRound className="h-3.5 w-3.5 mr-2"/>Reset password</DropdownMenuItem>
    <DropdownMenuItem onClick={()=>state.resend(target)}><Mail className="h-3.5 w-3.5 mr-2"/>Resend invite</DropdownMenuItem>
    {target.id!==state.user?.id&&<DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={()=>state.setDialog({type:'delete',user:target})}>
      <Trash2 className="h-3.5 w-3.5 mr-2"/>Remove User</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
}
