import StatusBadge from '@/components/StatusBadge';
import {formatCurrency,formatDateShort} from '@/lib/helpers';

const value=value=>value===undefined||value===null||value===''?'Not provided':value;
export default function ApplicationViewSummary({application={}}) {
  return <section aria-label="Application summary" className="rounded-lg border bg-card p-4 space-y-3">
    <h3 className="font-semibold">Summary</h3>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><dt className="text-xs text-muted-foreground">App #</dt><dd className="mt-0.5 font-mono">{value(application.application_number)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><StatusBadge status={application.status}/></dd></div>
      <div><dt className="text-xs text-muted-foreground">NOFO / Program</dt><dd className="mt-0.5 break-words">{value([application.nofo_title,application.program_name||application.program_code].filter(Boolean).join(' · '))}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Requested</dt><dd className="mt-0.5">{formatCurrency(application.requested_amount)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Match</dt><dd className="mt-0.5">{formatCurrency(application.match_amount)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Awarded</dt><dd className="mt-0.5">{formatCurrency(application.awarded_amount)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Total expended</dt><dd className="mt-0.5">{formatCurrency(application.total_expended)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Submitted date</dt><dd className="mt-0.5">{application.submitted_at?formatDateShort(application.submitted_at):'Not provided'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Submitted by</dt><dd className="mt-0.5 break-words">{value(application.submitted_by)}</dd></div>
    </dl>
  </section>;
}
