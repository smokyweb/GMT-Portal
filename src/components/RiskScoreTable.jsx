import { useState, useEffect } from 'react';
import { computeRiskScores } from '../lib/riskEngine';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RiskScoreTable() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState(null);

  const load = async () => {
    setLoading(true);
    const result = await computeRiskScores();
    setScores(result);
    setLastRun(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-card rounded-xl border">
      <div className="flex items-center justify-between p-5 border-b">
        <div>
          <h2 className="font-semibold">Subrecipient Risk Scores</h2>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last computed: {lastRun.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : scores.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No approved grants to assess</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Risk Level</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-40">Score</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Open Flags</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Overdue Reports</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Variance Issues</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Audit Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {scores.map(row => (
                <tr key={row.orgName} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 font-medium">{row.orgName}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${row.level.bg} ${row.level.color}`}>
                      {row.score >= 70 && <AlertTriangle className="h-3 w-3" />}
                      {row.level.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.level.bar}`}
                          style={{ width: `${row.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{row.score}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">{row.breakdown.flags || '—'}</td>
                  <td className="p-3 text-center">{row.breakdown.overdueReports || '—'}</td>
                  <td className="p-3 text-center">{row.breakdown.varianceIssues || '—'}</td>
                  <td className="p-3 text-center">{row.breakdown.auditAnomalies || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}