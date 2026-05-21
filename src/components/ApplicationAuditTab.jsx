import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Clock, FileText, CreditCard, BarChart2, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import moment from 'moment';

const ACTION_COLORS = {
  Approved: 'bg-green-100 text-green-700',
  Denied: 'bg-red-100 text-red-700',
  RevisionRequested: 'bg-orange-100 text-orange-700',
  Submitted: 'bg-blue-100 text-blue-700',
  FlagCreated: 'bg-amber-100 text-amber-700',
  FlagResolved: 'bg-green-100 text-green-700',
  Updated: 'bg-purple-100 text-purple-700',
  NoteAdded: 'bg-slate-100 text-slate-700',
  AdditionalInfoRequested: 'bg-amber-100 text-amber-700',
  UnderReview: 'bg-blue-100 text-blue-700',
};

const PAYMENT_STATUS_CONFIG = {
  PendingDisbursement: { label: 'Pending Disbursement', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  SubmittedToFinance:  { label: 'Submitted to Finance', bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  Paid:                { label: 'Paid',                  bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  PaymentFailed:       { label: 'Payment Failed',        bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
};

const REPORT_STATUS_COLORS = {
  Pending: 'bg-slate-100 text-slate-700',
  Submitted: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-700',
  Approved: 'bg-green-100 text-green-700',
  Denied: 'bg-red-100 text-red-700',
};

function PaymentBadge({ status }) {
  if (!status) return null;
  const cfg = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.PendingDisbursement;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function FundingRequestCard({ req }) {
  const statusColor = ACTION_COLORS[req.status] || 'bg-slate-100 text-slate-700';
  return (
    <div className="mt-2 bg-muted/40 border rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-semibold text-foreground">{req.request_number} — {req.request_type}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
          {req.status?.replace(/([A-Z])/g, ' $1').trim()}
        </span>
      </div>
      <div className="flex flex-wrap gap-4 text-muted-foreground">
        <span>Requested: <span className="font-medium text-foreground">${(req.amount_requested || 0).toLocaleString()}</span></span>
        {req.amount_approved != null && (
          <span>Approved: <span className="font-medium text-green-700">${(req.amount_approved || 0).toLocaleString()}</span></span>
        )}
        {(req.period_start || req.period_end) && (
          <span>Period: <span className="font-medium text-foreground">{req.period_start} – {req.period_end}</span></span>
        )}
      </div>
      {req.request_type !== 'Modification' && req.payment_status && (
        <div className="flex items-center gap-2">
          <CreditCard className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Payment:</span>
          <PaymentBadge status={req.payment_status} />
          {req.payment_reference && <span className="text-muted-foreground">Ref: <span className="font-mono text-foreground">{req.payment_reference}</span></span>}
          {req.payment_date && <span className="text-muted-foreground">on {req.payment_date}</span>}
        </div>
      )}
      {req.reviewer_notes && (
        <p className="text-muted-foreground italic">Notes: {req.reviewer_notes}</p>
      )}
    </div>
  );
}

function ReportCard({ report }) {
  const statusColor = REPORT_STATUS_COLORS[report.status] || 'bg-slate-100 text-slate-700';
  return (
    <div className="mt-2 bg-muted/40 border rounded-lg p-3 space-y-1 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-semibold text-foreground">{report.report_type} Report</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{report.status}</span>
      </div>
      <div className="flex flex-wrap gap-4 text-muted-foreground">
        {(report.period_start || report.period_end) && (
          <span>Period: <span className="font-medium text-foreground">{report.period_start} – {report.period_end}</span></span>
        )}
        {report.due_date && (
          <span>Due: <span className="font-medium text-foreground">{report.due_date}</span></span>
        )}
      </div>
    </div>
  );
}

export default function ApplicationAuditTab({ applicationId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) return;
    Promise.all([
      base44.entities.AuditLog.filter({ entity_id: applicationId }, '-created_date', 100),
      base44.entities.FundingRequest.filter({ application_id: applicationId }, '-created_date', 50),
      base44.entities.ReportSchedule.filter({ application_id: applicationId }, '-created_date', 50),
    ]).then(([logs, fundingRequests, reports]) => {
      const timeline = [
        ...logs.map(l => ({ ...l, _type: 'audit', _date: l.created_date })),
        ...fundingRequests.map(r => ({ ...r, _type: 'funding', _date: r.created_date })),
        ...reports.map(r => ({ ...r, _type: 'report', _date: r.created_date })),
      ].sort((a, b) => new Date(b._date) - new Date(a._date));
      setItems(timeline);
      setLoading(false);
    });
  }, [applicationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-30" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => {
        if (item._type === 'funding') {
          return (
            <div key={`fr-${item.id}`} className="flex gap-3 items-start py-3 border-b last:border-0">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                {idx < items.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-foreground">Funding Request</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {moment(item._date).format('MMM DD, YYYY h:mm A')}
                  </span>
                </div>
                <FundingRequestCard req={item} />
              </div>
            </div>
          );
        }

        if (item._type === 'report') {
          return (
            <div key={`rpt-${item.id}`} className="flex gap-3 items-start py-3 border-b last:border-0">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                {idx < items.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <BarChart2 className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-foreground">Report Schedule</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {moment(item._date).format('MMM DD, YYYY h:mm A')}
                  </span>
                </div>
                <ReportCard report={item} />
              </div>
            </div>
          );
        }

        // Default: audit log entry
        const actionColor = ACTION_COLORS[item.action] || 'bg-slate-100 text-slate-700';
        return (
          <div key={`log-${item.id}`} className="flex gap-3 items-start py-3 border-b last:border-0">
            <div className="flex flex-col items-center mt-1">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              {idx < items.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionColor}`}>
                  {item.action?.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {item.user_name || item.user_email || 'System'}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {moment(item._date).format('MMM DD, YYYY h:mm A')}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}