import {Input,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui';
import {roleLabel} from '@/lib/adminAccountData';
export default function AccountFilters({state}) {
  return <div className="flex flex-wrap gap-3 items-center">
    <Input aria-label="Search users" placeholder="Search by name or email…" value={state.search} onChange={e=>state.setSearch(e.target.value)} className="max-w-xs"/>
    <Select value={state.roleFilter} onValueChange={state.setRoleFilter}><SelectTrigger className="w-48" aria-label="Filter users by role"><SelectValue/></SelectTrigger>
      <SelectContent><SelectItem value="all">All Roles</SelectItem>
        {['user','reviewer','admin','isc_admin','federal_officer','federal_admin'].map(role=><SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent></Select>
    <Select value={state.statusFilter} onValueChange={state.setStatusFilter}><SelectTrigger className="w-40" aria-label="Filter users by status"><SelectValue/></SelectTrigger>
      <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem><SelectItem value="invited">Invited</SelectItem></SelectContent></Select>
    <div className="ml-auto px-3 py-1.5 bg-primary/10 text-primary text-sm font-semibold rounded-full">
      {state.users.length} user{state.users.length!==1?'s':''}</div>
  </div>;
}
