import {Button} from './ui';
import {downloadAccountCsv,importErrorCsv} from '@/lib/accountCsv';
export default function BulkAccountResult({result}) {
  return <section className="space-y-3" role="status">
    <p className="font-semibold">{result.succeeded} invitation{result.succeeded!==1?'s':''} accepted by the email provider; {result.failed} failed.</p>
    <p className="text-sm text-muted-foreground">Each new user receives a one-time set-password link. Your current administrator session is preserved.</p>
    {result.failed>0&&<><ul className="text-sm text-red-700 space-y-1">{result.rows.filter(row=>!row.success).map(row=><li key={row.row}>Row {row.row}: {row.email} — {row.error}</li>)}</ul>
      <Button size="sm" variant="outline" onClick={()=>downloadAccountCsv(importErrorCsv(result.rows),'user_import_errors.csv')}>Download errors</Button></>}
  </section>;
}
