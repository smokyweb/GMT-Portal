import SimpleFieldInput from './SimpleFieldInput';
export default function RepeatingFieldTable({field,value,onChange,disabled}) {
  const rows=Array.isArray(value)?value:[];
  const cell=(index,key,data)=>onChange(rows.map((row,i)=>i===index?{...row,[key]:data}:row));
  return <div className="space-y-2">
    <div className="overflow-x-auto border rounded"><table className="w-full text-sm"><thead><tr>{field.columns.map(column=><th key={column.id} className="text-left px-2 py-2 whitespace-nowrap">{column.label}{column.required?' *':''}</th>)}<th className="sr-only">Remove</th></tr></thead>
      <tbody>{rows.map((row,index)=><tr key={index} className="border-t">{field.columns.map(column=><td key={column.id} className="p-2 min-w-36"><SimpleFieldInput field={{...column,id:field.id+'_'+index+'_'+column.id}} value={row[column.id]} onChange={data=>cell(index,column.id,data)} label={field.label+' row '+(index+1)+' '+column.label} disabled={disabled}/></td>)}<td className="px-2"><button type="button" disabled={disabled} aria-label={'Remove '+field.label+' row '+(index+1)} className="text-red-700" onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>Remove</button></td></tr>)}</tbody>
    </table></div>
    <button type="button" disabled={disabled||rows.length>=200} onClick={()=>onChange([...rows,{}])} className="border rounded px-3 py-2 text-sm">+ Add row</button>
  </div>;
}
