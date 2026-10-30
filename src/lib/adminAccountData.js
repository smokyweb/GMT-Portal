export const roleLabel = role => ({isc_admin:'ISC Administrator',admin:'State Administrator',reviewer:'Reviewer',user:'Subrecipient',federal_admin:'Federal Administrator',federal_officer:'Federal Program Officer'}[role]||role);
export const roleBadge = role => ['admin','isc_admin'].includes(role)?'bg-purple-50 text-purple-700':role==='reviewer'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600';
export function accountStats(users) {
  return {totalUsers:users.length,adminUsers:users.filter(u=>['admin','isc_admin','federal_admin'].includes(u.role)).length};
}
export function filterAccounts(users,{search='',role='all',status='all',column='name',direction='asc'}={}) {
  const value=search.toLowerCase().trim();
  const filtered=users.filter(u=>(!value||[u.full_name,u.email,u.organization_name].some(v=>String(v||'').toLowerCase().includes(value)))&&
    (role==='all'||u.role===role)&&(status==='all'||u.active_status===status));
  const sortValue=user=>column==='activity'?(user.last_login?Date.parse(user.last_login):0):
    column==='role'?user.role||'':String(user.full_name||user.email||'').toLowerCase();
  return filtered.sort((a,b)=>{
    const left=sortValue(a),right=sortValue(b),result=left<right?-1:left>right?1:0;
    return direction==='asc'?result:-result;
  });
}
export function availableOrganizations(organizations,user) {
  const state=user?.scope_state||user?.grantee_state;
  return organizations.filter(org=>org.is_active!==false &&
    (user?.role==='isc_admin'||Boolean(state&&org.state?.toUpperCase()===state.toUpperCase())));
}
export function accountInitials(user) {
  return (user.full_name||user.email||'U').split(' ').map(part=>part[0]||'').slice(0,2).join('').toUpperCase();
}
export function accountActivity(user) {
  return user.last_login?new Date(user.last_login).toLocaleString():'Never signed in';
}
