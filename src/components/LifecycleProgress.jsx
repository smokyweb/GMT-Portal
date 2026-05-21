import { Check, Clock, AlertCircle, XCircle, ChevronRight } from 'lucide-react';

const APPLICATION_STEPS = [
  { key: 'Draft',            label: 'Draft',           description: 'Application is being prepared' },
  { key: 'Submitted',        label: 'Submitted',        description: 'Submitted for initial review' },
  { key: 'PendingReview',    label: 'Pending Review',   description: 'In the review queue' },
  { key: 'UnderReview',      label: 'Under Review',     description: 'Actively being reviewed' },
  { key: 'RevisionRequested',label: 'Revision Needed',  description: 'Changes requested by reviewer' },
  { key: 'Approved',         label: 'Approved',         description: 'Application approved' },
  { key: 'Denied',           label: 'Denied',           description: 'Application not approved' },
];

const FUNDING_STEPS = [
  { key: 'Submitted',              label: 'Submitted',         description: 'Request submitted for review' },
  { key: 'UnderReview',            label: 'Under Review',      description: 'Being reviewed by state' },
  { key: 'AdditionalInfoRequested',label: 'Info Requested',    description: 'More information needed' },
  { key: 'Approved',               label: 'Approved',          description: 'Request approved for payment' },
  { key: 'Denied',                 label: 'Denied',            description: 'Request not approved' },
];

const TERMINAL_POSITIVE = ['Approved'];
const TERMINAL_NEGATIVE = ['Denied'];
const REVISION_STEP     = 'RevisionRequested';
const INFO_STEP         = 'AdditionalInfoRequested';

function getStepState(step, currentStatus, steps) {
  const currentIndex  = steps.findIndex(s => s.key === currentStatus);
  const stepIndex     = steps.findIndex(s => s.key === step.key);
  const isCurrent     = step.key === currentStatus;
  const isTermNeg     = TERMINAL_NEGATIVE.includes(currentStatus);
  const isRevision    = currentStatus === REVISION_STEP || currentStatus === INFO_STEP;

  if (isCurrent) {
    if (TERMINAL_POSITIVE.includes(step.key)) return 'complete';
    if (TERMINAL_NEGATIVE.includes(step.key)) return 'error';
    if (step.key === REVISION_STEP || step.key === INFO_STEP) return 'warning';
    return 'active';
  }
  if (stepIndex < currentIndex && !isTermNeg) return 'complete';
  if (stepIndex < currentIndex && isTermNeg && !TERMINAL_NEGATIVE.includes(step.key)) return 'complete';
  return 'upcoming';
}

const STATE_STYLES = {
  complete: { ring: 'bg-green-500 border-green-500',  icon: <Check className="h-3.5 w-3.5 text-white" />,          label: 'text-green-700', connector: 'bg-green-400' },
  active:   { ring: 'bg-primary border-primary',       icon: <Clock className="h-3.5 w-3.5 text-white" />,          label: 'text-primary font-semibold', connector: 'bg-border' },
  warning:  { ring: 'bg-amber-500 border-amber-500',   icon: <AlertCircle className="h-3.5 w-3.5 text-white" />,    label: 'text-amber-700 font-semibold', connector: 'bg-border' },
  error:    { ring: 'bg-red-500 border-red-500',        icon: <XCircle className="h-3.5 w-3.5 text-white" />,       label: 'text-red-700 font-semibold', connector: 'bg-border' },
  upcoming: { ring: 'bg-muted border-border',           icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/30 block" />, label: 'text-muted-foreground', connector: 'bg-border' },
};

export default function LifecycleProgress({ status, type = 'application', className = '' }) {
  const steps = type === 'funding' ? FUNDING_STEPS : APPLICATION_STEPS;

  // Filter out the opposing terminal step so we don't show "Denied" when Approved and vice versa
  const isApproved = status === 'Approved';
  const isDenied   = TERMINAL_NEGATIVE.includes(status);
  const visibleSteps = steps.filter(s => {
    if (isApproved && TERMINAL_NEGATIVE.includes(s.key)) return false;
    if (isDenied   && TERMINAL_POSITIVE.includes(s.key)) return false;
    return true;
  });

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: vertical */}
      <div className="flex flex-col gap-0 sm:hidden">
        {visibleSteps.map((step, i) => {
          const state  = getStepState(step, status, steps);
          const styles = STATE_STYLES[state];
          const isLast = i === visibleSteps.length - 1;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${styles.ring}`}>
                  {styles.icon}
                </div>
                {!isLast && <div className={`w-0.5 h-6 ${styles.connector} mt-0.5`} />}
              </div>
              <div className="pb-5">
                <p className={`text-sm ${styles.label}`}>{step.label}</p>
                {state === 'active' || state === 'warning' || state === 'error' ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start">
        {visibleSteps.map((step, i) => {
          const state  = getStepState(step, status, steps);
          const styles = STATE_STYLES[state];
          const isLast = i === visibleSteps.length - 1;
          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center w-full">
                  <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${styles.ring}`}>
                    {styles.icon}
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-0.5 ${state === 'complete' ? 'bg-green-400' : 'bg-border'}`} />
                  )}
                </div>
                <div className="mt-2 text-center px-1 w-full">
                  <p className={`text-xs leading-tight ${styles.label}`}>{step.label}</p>
                  {(state === 'active' || state === 'warning' || state === 'error') && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{step.description}</p>
                  )}
                </div>
              </div>
              {!isLast && <div className="w-0 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}