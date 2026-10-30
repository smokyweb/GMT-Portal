import {Button} from './ui';
import {downloadAccountCsv,importErrorCsv} from '@/lib/accountCsv';
export default function BulkAccountPreview({preview}) {
  return <section className="space-y-3"><div className="flex justify-between items-center">
    <p className="text-sm font-semibold">Dry run — {preview.valid} ready, {preview.invalid} with errors</p>
    {preview.invalid>0&&<Button size="sm" variant="outline" onClick={()=>downloadAccountCsv(importErrorCsv(preview.rows),'user_import_errors.csv')}>Download errors</Button>}</div>
    <div className="border rounded-lg max-h-64 overflow-auto"><table className="w-full text-xs">
      <thead className="bg-muted/40"><tr>{['Row','Email','Role','Organization','Result'].map(label=><th key={label} className="p-2 text-left">{label}</th>)}</tr></thead>
      <tbody>{preview.rows.map(row=><tr key={row.row} className="border-t">
        <td className="p-2">{row.row}</td><td className="p-2">{row.email}</td><td className="p-2">{row.data?.role||'—'}</td>
        <td className="p-2">{row.data?.organization_name||'—'}</td><td className={`p-2 ${row.errors.length?'text-red-700':'text-green-700'}`}>{row.errors.join('; ')||'Ready'}</td>
      </tr>)}</tbody>
    </table></div><p className="text-xs text-muted-foreground">No accounts or emails are created during the dry run. Importing sends a one-time set-password invitation for each ready row.</p>
  </section>;
}
