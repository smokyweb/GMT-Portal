import moment from 'moment';
import { CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { STATUS_CONFIG } from '../lib/helpers';

export default function ApplicationHistory({ milestones, applicationId }) {
  const appMilestones = milestones
    .filter(m => m.application_id === applicationId)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const completedCount = appMilestones.filter(m => m.status === 'Completed').length;
  const pct = appMilestones.length > 0 ? Math.round((completedCount / appMilestones.length) * 100) : 0;

  if (appMilestones.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-6">
        No milestone history for this application.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{completedCount}/{appMilestones.length}</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-3">
          {appMilestones.map((m, idx) => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.Upcoming;
            const Icon = cfg.icon;
            const daysUntil = moment(m.due_date).diff(moment(), 'days');
            return (
              <div key={m.id} className="flex gap-3 pl-4">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center mt-0.5 ${cfg.bg}`}>
                  <Icon className={`h-3 w-3 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due {moment(m.due_date).format('MMM D, YYYY')}
                        {m.status !== 'Completed' && m.status !== 'Waived' && (
                          <span className={`ml-2 font-medium ${daysUntil < 0 ? 'text-red-600' : daysUntil <= 7 ? 'text-amber-600' : ''}`}>
                            {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'today' : `in ${daysUntil}d`}
                          </span>
                        )}
                      </p>
                      {m.completed_date && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Completed {moment(m.completed_date).format('MMM D, YYYY')}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}