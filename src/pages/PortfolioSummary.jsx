import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PortfolioSummary() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stateData, setStateData] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);

      // Check access: ISC/Federal only
      const isFederal = ['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role);
      if (!isFederal) {
        setLoading(false);
        return;
      }

      // Load all data
      const [apps, frs, flags, orgs, grantees] = await Promise.all([
        base44.entities.Application.list('-created_date', 1000),
        base44.entities.FundingRequest.list('-created_date', 1000),
        base44.entities.ComplianceFlag.list('-created_date', 1000),
        base44.entities.Organization.list(),
        base44.entities.Grantee.list(),
      ]);

      // Group by state
      const stateMap = {};
      grantees.filter(g => g.is_active).forEach(g => {
        stateMap[g.state_code] = { ...g, apps: 0, subrecipients: 0, totalAwarded: 0, pendingApps: 0, openFlags: 0, lastActivity: null };
      });

      // Count orgs per state
      orgs.forEach(o => {
        if (stateMap[o.state]) {
          stateMap[o.state].subrecipients++;
        }
      });

      // Map apps to states
      apps.forEach(a => {
        const org = orgs.find(o => o.id === a.organization_id);
        if (org && stateMap[org.state]) {
          stateMap[org.state].apps++;
          if (a.status === 'Approved') {
            stateMap[org.state].totalAwarded += a.awarded_amount || 0;
          }
          if (a.status === 'Submitted') {
            stateMap[org.state].pendingApps++;
          }
          const appDate = new Date(a.created_date);
          if (!stateMap[org.state].lastActivity || appDate > new Date(stateMap[org.state].lastActivity)) {
            stateMap[org.state].lastActivity = a.created_date;
          }
        }
      });

      // Map flags to states
      flags.forEach(f => {
        const org = orgs.find(o => o.id === f.organization_id);
        if (org && stateMap[org.state] && !f.is_resolved) {
          stateMap[org.state].openFlags++;
        }
      });

      const states = Object.values(stateMap).sort((a, b) => b.totalAwarded - a.totalAwarded);
      setStateData(states);

      // Chart data
      setChartData(states.slice(0, 10).map(s => ({
        state: s.state_code,
        awarded: s.totalAwarded,
      })));

      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (user && !['isc_admin', 'federal_admin', 'federal_officer'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="font-semibold">Access Restricted</p>
          <p className="text-sm text-muted-foreground">This page is only available to ISC and Federal administrators.</p>
        </div>
      </div>
    );
  }

  const totalAwarded = stateData.reduce((s, st) => s + st.totalAwarded, 0);
  const totalSubrecipients = stateData.reduce((s, st) => s + st.subrecipients, 0);
  const totalPendingApps = stateData.reduce((s, st) => s + st.pendingApps, 0);
  const totalOpenFlags = stateData.reduce((s, st) => s + st.openFlags, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Summary</h1>
        <p className="text-muted-foreground text-sm mt-1">Multi-state funding overview and performance metrics</p>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Awarded', value: `$${(totalAwarded / 1000000).toFixed(1)}M` },
          { label: 'Total Subrecipients', value: totalSubrecipients },
          { label: 'Pending Applications', value: totalPendingApps },
          { label: 'Open Compliance Flags', value: totalOpenFlags },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Funding Distribution by State (Top 10)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="state" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `$${(v / 1000000).toFixed(2)}M`} />
              <Bar dataKey="awarded" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>
        )}
      </div>

      {/* States Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">State</th>
                <th className="text-center p-3 font-medium">Subrecipients</th>
                <th className="text-right p-3 font-medium">Total Awarded</th>
                <th className="text-center p-3 font-medium">Pending Apps</th>
                <th className="text-center p-3 font-medium">Open Flags</th>
                <th className="text-left p-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {stateData.map(state => (
                <tr key={state.state_code} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-semibold">{state.state_code} - {state.name}</td>
                  <td className="p-3 text-center">{state.subrecipients}</td>
                  <td className="p-3 text-right font-mono">${(state.totalAwarded / 1000000).toFixed(1)}M</td>
                  <td className="p-3 text-center">{state.pendingApps}</td>
                  <td className="p-3 text-center">{state.openFlags}</td>
                  <td className="p-3 text-xs text-muted-foreground">{state.lastActivity ? new Date(state.lastActivity).toLocaleDateString() : ' - '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}