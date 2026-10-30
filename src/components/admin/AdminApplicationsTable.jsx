import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/admin/ui';
import StatusBadge from '@/components/StatusBadge';
import {formatCurrency,formatDateShort} from '@/lib/helpers';
export default function AdminApplicationsTable({applications,filter,onFilter,onStatus}) {
 return <>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={onFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="UnderReview">Under Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Denied">Denied</SelectItem>
                <SelectItem value="RevisionRequested">Revision Requested</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{applications.length} applications</span>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Submitted</th>
                    <th className="p-3 font-medium text-muted-foreground">Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                      <td className="p-3 font-medium">{app.organization_name || '—'}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{app.program_code || '—'}</span></td>
                      <td className="p-3 text-right">{formatCurrency(app.requested_amount)}</td>
                      <td className="p-3"><StatusBadge status={app.status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                      <td className="p-3">
                        <Select value={app.status} onValueChange={v => onStatus(app, v)}>
                          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Draft','Submitted','PendingReview','UnderReview','RevisionRequested','Approved','Denied'].map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                  {applications.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No applications found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>;
}
