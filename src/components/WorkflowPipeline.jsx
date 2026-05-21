import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, DollarSign, BarChart3, Shield, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const APPROVAL_PIPELINE = [
  { key: 'Submitted', label: 'Programmatic Review', color: 'bg-blue-500' },
  { key: 'UnderReview', label: 'Technical Review', color: 'bg-amber-500' },
  { key: 'RevisionRequested', label: 'Finance Review', color: 'bg-orange-500' },
  { key: 'Approved', label: 'Closeout', color: 'bg-green-500' },
];

const STAGES = [
  {
    key: 'submitted',
    label: 'Submitted',
    icon: FileText,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    dot: 'bg-blue-500',
    actionLabel: 'Review Now',
    actionPath: '/applications',
    description: (n) => `${n} application${n !== 1 ? 's' : ''} awaiting initial review`,
  },
  {
    key: 'underReview',
    label: 'Under Review',
    icon: ClipboardList,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
    actionLabel: 'Continue Review',
    actionPath: '/applications',
    description: (n) => `${n} application${n !== 1 ? 's' : ''} currently under review`,
  },
  {
    key: 'revisionRequested',
    label: 'Revision Requested',
    icon: ArrowRight,
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    dot: 'bg-orange-500',
    actionLabel: 'View Pending',
    actionPath: '/applications',
    description: (n) => `${n} application${n !== 1 ? 's' : ''} awaiting subrecipient revision`,
  },
  {
    key: 'fundingReqs',
    label: 'Funding Requests',
    icon: DollarSign,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    dot: 'bg-purple-500',
    actionLabel: 'Review Requests',
    actionPath: '/funding-requests',
    description: (n) => `${n} funding request${n !== 1 ? 's' : ''} pending approval`,
  },
  {
    key: 'overdueReports',
    label: 'Overdue Reports',
    icon: BarChart3,
    color: 'bg-red-50 border-red-200 text-red-700',
    dot: 'bg-red-500',
    actionLabel: 'View Reports',
    actionPath: '/reports',
    description: (n) => `${n} report${n !== 1 ? 's' : ''} past due date`,
  },
  {
    key: 'complianceFlags',
    label: 'Compliance Flags',
    icon: Shield,
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    dot: 'bg-rose-500',
    actionLabel: 'Resolve Flags',
    actionPath: '/compliance',
    description: (n) => `${n} unresolved compliance flag${n !== 1 ? 's' : ''}`,
  },
  {
    key: 'openRfis',
    label: 'Open RFIs',
    icon: AlertTriangle,
    color: 'bg-red-50 border-red-200 text-red-700',
    dot: 'bg-red-500',
    actionLabel: 'Review Applications',
    actionPath: '/applications',
    description: (n) => `${n} open RFI${n !== 1 ? 's' : ''} blocking approval`,
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: CheckCircle,
    color: 'bg-green-50 border-green-200 text-green-700',
    dot: 'bg-green-500',
    actionLabel: 'View Portfolio',
    actionPath: '/analytics',
    description: (n) => `${n} active approved grant${n !== 1 ? 's' : ''}`,
  },
];

export default function WorkflowPipeline({ apps = [], fundingReqs = [], flags = [], reports = [], tasks = [] }) {
  const counts = {
    submitted: apps.filter(a => a.status === 'Submitted').length,
    underReview: apps.filter(a => ['PendingReview', 'UnderReview'].includes(a.status)).length,
    revisionRequested: apps.filter(a => a.status === 'RevisionRequested').length,
    fundingReqs: fundingReqs.filter(fr => ['Submitted', 'UnderReview', 'AdditionalInfoRequested'].includes(fr.status)).length,
    overdueReports: reports.filter(r => r.status === 'Overdue').length,
    complianceFlags: flags.length,
    approved: apps.filter(a => a.status === 'Approved').length,
    openRfis: tasks.filter(t => t.type === 'RFI' && !['Resolved', 'Cancelled'].includes(t.status)).length,
  };

  // Pipeline stage counts
  const pipelineCounts = {
    Submitted: apps.filter(a => a.status === 'Submitted').length,
    UnderReview: apps.filter(a => ['PendingReview', 'UnderReview'].includes(a.status)).length,
    RevisionRequested: apps.filter(a => a.status === 'RevisionRequested').length,
    Approved: apps.filter(a => a.status === 'Approved').length,
  };
  const totalInPipeline = Object.values(pipelineCounts).reduce((s, n) => s + n, 0);

  const actionStages = STAGES.filter(s => counts[s.key] > 0);
  const allClear = actionStages.length === 0;

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div>
          <h2 className="font-semibold">Workflow Pipeline</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Items requiring action across the grant lifecycle</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          allClear ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {allClear ? 'All clear' : `${actionStages.length} stage${actionStages.length !== 1 ? 's' : ''} need attention`}
        </span>
      </div>

      {/* Approval Pipeline Visualization */}
      {totalInPipeline > 0 && (
        <div className="px-5 py-4 border-b bg-muted/20">
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Approval Pipeline</p>
          <div className="flex items-center gap-0">
            {APPROVAL_PIPELINE.map((stage, idx) => {
              const count = pipelineCounts[stage.key] || 0;
              const isActive = count > 0;
              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-1 rounded-md px-2 py-2 text-center transition ${
                    isActive ? `${stage.color} text-white shadow-sm` : 'bg-muted/50 text-muted-foreground'
                  }`}>
                    <div className={`text-lg font-bold leading-none ${isActive ? 'text-white' : 'text-muted-foreground/40'}`}>{count}</div>
                    <div className={`text-[10px] mt-0.5 font-medium leading-tight ${isActive ? 'text-white/90' : 'text-muted-foreground/60'}`}>{stage.label}</div>
                  </div>
                  {idx < APPROVAL_PIPELINE.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 mx-1 shrink-0 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allClear ? (
        <div className="p-10 text-center text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="font-medium text-green-700">Everything is up to date!</p>
          <p className="text-sm mt-1">No items require action at this time.</p>
        </div>
      ) : (
        <div className="divide-y">
          {STAGES.map(stage => {
            const count = counts[stage.key];
            if (count === 0) return null;
            const Icon = stage.icon;
            return (
              <div key={stage.key} className={`flex items-center justify-between px-5 py-3.5 ${stage.color} border-l-4 ${stage.dot.replace('bg-', 'border-l-')}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stage.dot} bg-opacity-15`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold">
                      {count} {stage.label}
                    </span>
                    <p className="text-xs opacity-80">{stage.description(count)}</p>
                  </div>
                </div>
                <Link
                  to={stage.actionPath}
                  className="flex items-center gap-1 text-xs font-semibold hover:underline underline-offset-2 whitespace-nowrap ml-4"
                >
                  {stage.actionLabel} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary row: approved count */}
      {counts.approved > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t bg-green-50/40">
          <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
            <CheckCircle className="h-3.5 w-3.5" />
            {counts.approved} approved grant{counts.approved !== 1 ? 's' : ''} active in portfolio
          </div>
          <Link to="/analytics" className="text-xs font-semibold text-green-700 hover:underline flex items-center gap-1">
            View Analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}