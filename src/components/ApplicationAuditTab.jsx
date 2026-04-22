import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { User, Clock, FileText } from 'lucide-react';
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
};

export default function ApplicationAuditTab({ applicationId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) return;
    base44.entities.AuditLog.filter({ entity_id: applicationId }, '-created_date', 100)
      .then(data => {
        setLogs(data);
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

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-30" />
        <p className="text-sm">No audit history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {logs.map((log, idx) => {
        const actionColor = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700';
        return (
          <div key={log.id} className="flex gap-3 items-start py-3 border-b last:border-0">
            {/* Timeline dot */}
            <div className="flex flex-col items-center mt-1">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              {idx < logs.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${actionColor}`}>
                  {log.action?.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.user_name || log.user_email || 'System'}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                  <Clock className="h-3 w-3" />
                  {moment(log.created_date).format('MMM DD, YYYY h:mm A')}
                </span>
              </div>
              {log.description && (
                <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}