import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function CloseoutChecklist() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stateMode, setStateMode] = useState(true);
  const [selectedState, setSelectedState] = useState(null);
  const [stateList, setStateList] = useState([]);
  const [checklists, setChecklists] = useState({});

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      
      const isFederal = ['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role);
      const isStateAdmin = u.role === 'admin' || u.role === 'reviewer';

      // Load grantees
      const grantees = await base44.entities.Grantee.list('-created_date', 100);
      setStateList(grantees.filter(g => g.is_active));

      if (isStateAdmin && !isFederal && u.scope_state) {
        setStateMode(false);
        setSelectedState(u.scope_state);
        await loadChecklistForState(u.scope_state);
      } else if (grantees.length > 0) {
        setSelectedState(grantees[0].state_code);
        await loadChecklistForState(grantees[0].state_code);
      }

      setLoading(false);
    });
  }, []);

  const loadChecklistForState = async (stateCode) => {
    const [orgs, milestones, flags, reports, docs] = await Promise.all([
      base44.entities.Organization.list(),
      base44.entities.Milestone.list('-created_date', 500),
      base44.entities.ComplianceFlag.list('-created_date', 500),
      base44.entities.ProgressReport.list('-created_date', 500),
      base44.entities.Document.list('-created_date', 500),
    ]);

    const stateOrgs = orgs.filter(o => o.state === stateCode).map(o => o.id);
    const stateMilestones = milestones.filter(m => stateOrgs.includes(m.organization_id));
    const stateFlags = flags.filter(f => stateOrgs.includes(f.organization_id));
    const stateReports = reports.filter(r => stateOrgs.some(o => r.application_id?.includes(o)));
    const stateDocs = docs.filter(d => stateOrgs.includes(d.organization_id));

    const milestonesComplete = stateMilestones.length === 0 || stateMilestones.every(m => m.status === 'Completed' || m.status === 'Waived');
    const flagsResolved = stateFlags.length === 0 || stateFlags.every(f => f.is_resolved);
    const reportsSubmitted = stateReports.length === 0 || stateReports.every(r => r.status === 'Approved');
    const docsArchived = stateDocs.length === 0 || stateDocs.every(d => d.review_status === 'Approved');

    const completedItems = [
      milestonesComplete,
      flagsResolved,
      reportsSubmitted,
      docsArchived,
    ].filter(Boolean).length;
    const readinessScore = Math.round((completedItems / 4) * 100);

    setChecklists(prev => ({
      ...prev,
      [stateCode]: {
        milestonesComplete,
        flagsResolved,
        reportsSubmitted,
        docsArchived,
        readinessScore,
        remainingMilestones: stateMilestones.filter(m => m.status !== 'Completed').length,
        remainingFlags: stateFlags.filter(f => !f.is_resolved).length,
        remainingReports: stateReports.filter(r => r.status !== 'Approved').length,
        remainingDocs: stateDocs.filter(d => d.review_status !== 'Approved').length,
      },
    }));
  };

  const handleStateChange = async (state) => {
    setSelectedState(state);
    if (!checklists[state]) {
      await loadChecklistForState(state);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const current = checklists[selectedState];

  const items = [
    { label: 'All Milestones Completed', complete: current?.milestonesComplete, remaining: current?.remainingMilestones, path: '/milestones' },
    { label: 'All Compliance Flags Resolved', complete: current?.flagsResolved, remaining: current?.remainingFlags, path: '/compliance' },
    { label: 'All Final Reports Submitted', complete: current?.reportsSubmitted, remaining: current?.remainingReports, path: '/reports' },
    { label: 'All Documents Archived', complete: current?.docsArchived, remaining: current?.remainingDocs, path: '/documents' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Closeout Checklist</h1>
        <p className="text-muted-foreground text-sm mt-1">Track grant closeout readiness and completion status</p>
      </div>

      {/* State Selector */}
      {stateMode && (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm font-medium mb-3">Select State</p>
          <div className="flex flex-wrap gap-2">
            {stateList.map(state => (
              <button
                key={state.state_code}
                onClick={() => handleStateChange(state.state_code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedState === state.state_code
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {state.state_code}
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <>
          {/* Readiness Score */}
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Overall Readiness Score</h2>
              <p className="text-3xl font-bold text-primary">{current.readinessScore}%</p>
            </div>
            <Progress value={current.readinessScore} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">{Math.ceil((4 * current.readinessScore) / 100)} of 4 items completed</p>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="bg-card border rounded-xl p-4 flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {item.complete ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${item.complete ? 'text-foreground' : 'text-foreground'}`}>{item.label}</p>
                  {!item.complete && item.remaining > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">{item.remaining} item{item.remaining !== 1 ? 's' : ''} remaining</p>
                  )}
                </div>
                {!item.complete && (
                  <a href={item.path} className="text-primary text-sm font-medium hover:underline flex-shrink-0">
                    Go Fix →
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}