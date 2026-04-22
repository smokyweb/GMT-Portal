import { useState } from 'react';
import { runGrantMonitor } from '../lib/monitoringService';
import { Activity, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SEVERITY_COLORS = {
  Critical: 'text-red-700 bg-red-50 border-red-200',
  High: 'text-orange-700 bg-orange-50 border-orange-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  Low: 'text-slate-700 bg-slate-50 border-slate-200',
};

export default function MonitoringPanel({ user }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setResults(null);
    const res = await runGrantMonitor(user);
    setResults(res);
    setLastRun(new Date());
    setExpanded(true);
    setRunning(false);
  };

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Automated Grant Monitor</h2>
            <p className="text-xs text-muted-foreground">
              {lastRun ? `Last run: ${lastRun.toLocaleTimeString()}` : 'Checks expenditure rates, burn rates & overdue reports'}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleRun} disabled={running}>
          {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Running…</> : 'Run Monitor'}
        </Button>
      </div>

      {results && (
        <div className="p-4 space-y-3">
          {/* Summary */}
          <div className="flex items-center gap-4">
            {results.created > 0 ? (
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {results.created} new flag{results.created !== 1 ? 's' : ''} created
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                No new anomalies detected
              </div>
            )}
            {results.skipped > 0 && (
              <span className="text-xs text-muted-foreground">{results.skipped} duplicate{results.skipped !== 1 ? 's' : ''} skipped</span>
            )}
            {results.checks.length > 0 && (
              <button
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                onClick={() => setExpanded(e => !e)}
              >
                Details {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Detail list */}
          {expanded && results.checks.length > 0 && (
            <div className="space-y-2">
              {results.checks.map((c, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.Low}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">[{c.severity}] {c.type}</span>
                    <span className="mx-1">·</span>
                    <span className="font-medium">{c.app}</span>
                    <span className="mx-1">·</span>
                    <span>{c.org}</span>
                    <p className="mt-0.5 opacity-80">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}