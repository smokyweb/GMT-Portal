import {ArrowUp,ArrowDown} from 'lucide-react';
export default function AccountSortHeading({column,label,state}) {
  return <th className="text-left p-3 font-medium text-muted-foreground">
    <button onClick={()=>state.sort(column)} className="flex items-center gap-1 hover:text-foreground transition">
      {label}{state.sortColumn===column&&(state.sortDirection==='asc'?<ArrowUp className="h-3.5 w-3.5"/>:<ArrowDown className="h-3.5 w-3.5"/>)}
    </button>
  </th>;
}
