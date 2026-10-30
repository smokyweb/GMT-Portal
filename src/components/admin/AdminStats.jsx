import {Users,ShieldCheck} from 'lucide-react';
export default function AdminStats({stats}) {
  const cards=[{label:'Total Users',value:stats.totalUsers,icon:Users,color:'bg-blue-50 text-blue-600'},
    {label:'Admin Users',value:stats.adminUsers,icon:ShieldCheck,color:'bg-purple-50 text-purple-600'}];
  return <div className="grid grid-cols-2 gap-4">{cards.map(({label,value,icon:Icon,color})=>
    <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="h-5 w-5"/></div>
      <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </div>)}</div>;
}
