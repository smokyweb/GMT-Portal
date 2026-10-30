import {Download,FileText} from 'lucide-react';
import {Button} from './ui';
import {ACCOUNT_CSV_TEMPLATE,downloadAccountCsv} from '@/lib/accountCsv';
export default function BulkAccountTemplate() {
  return <section className="bg-muted/40 rounded-lg p-4 space-y-2">
    <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/>Step 1 — Download the Template</p>
    <p className="text-xs text-muted-foreground">Fill in user details and use an existing organization name or organization_id for each subrecipient.</p>
    <div className="bg-background border rounded text-xs font-mono p-2 overflow-x-auto whitespace-pre">{ACCOUNT_CSV_TEMPLATE.trim()}</div>
    <Button variant="outline" size="sm" className="gap-1.5" onClick={()=>downloadAccountCsv(ACCOUNT_CSV_TEMPLATE,'user_upload_template.csv')}>
      <Download className="h-3.5 w-3.5"/>Download Template</Button>
    <p className="text-xs text-muted-foreground">Roles: user, reviewer, admin, isc_admin. State-scoped roles need a two-letter state code. Passwords are never imported.</p>
  </section>;
}
