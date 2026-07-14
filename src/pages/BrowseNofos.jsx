import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { FileText, Calendar, DollarSign, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateShort } from '../lib/helpers';

export default function BrowseNofos() {
  const [nofos, setNofos] = useState([]);
  const [ineligibleCount, setIneligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasOrg, setHasOrg] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [user, allNofos] = await Promise.all([
        base44.auth.me(),
        base44.entities.Nofo.filter({ status: 'Published' }, '-created_date', 100),
      ]);

      // Load user's organization to get its type and state
      let orgType = null;
      let orgState = null;
      const orgId = user?.organization_id;
      setHasOrg(!!orgId);
      if (orgId) {
        try {
          const orgs = await base44.entities.Organization.filter({ id: orgId });
          orgType = orgs[0]?.type || null;
          orgState = orgs[0]?.state || null;
        } catch {}
      }

      const eligible = [];
      let ineligible = 0;

      for (const nofo of allNofos) {
        const eligibleTypes = nofo.eligible_org_types || [];
        const overrideIds = nofo.override_org_ids || [];
        const scopeStates = Array.isArray(nofo.scope_states)
          ? nofo.scope_states
          : (nofo.scope_states ? [nofo.scope_states] : []);

        // Check state scope first — if NOFO is restricted to specific states, org must be in one of them
        if (scopeStates.length > 0 && orgState && !scopeStates.includes(orgState)) {
          ineligible++;
          continue;
        }

        // Check override
        if (orgId && overrideIds.includes(orgId)) {
          eligible.push({ ...nofo, _override: true });
          continue;
        }

        // If no org type restrictions, org is eligible (subject to state check above)
        if (eligibleTypes.length === 0) {
          eligible.push(nofo);
          continue;
        }

        // Check org type match
        if (orgType && eligibleTypes.includes(orgType)) {
          eligible.push(nofo);
        } else {
          ineligible++;
        }
      }

      setNofos(eligible);
      setIneligibleCount(ineligible);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse Funding Opportunities</h1>
        <p className="text-muted-foreground text-sm mt-1">View open Notices of Funding Opportunity your organization is eligible for</p>
      </div>

      {ineligibleCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg text-sm text-muted-foreground">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>{ineligibleCount} additional {ineligibleCount === 1 ? 'opportunity is' : 'opportunities are'} not shown because your organization type is not eligible. Contact your state administrator for more information.</span>
        </div>
      )}

      {nofos.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">No Open Opportunities</h3>
          <p className="text-muted-foreground text-sm">There are no funding opportunities available for your organization type at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nofos.map(nofo => (
            <div key={nofo.id} className="bg-card rounded-xl border p-6 hover:shadow-lg transition-shadow space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{nofo.program_code}</span>
                    {nofo._override && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">Admin Override</span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg mt-2">{nofo.title}</h3>
                </div>
              </div>
              {nofo.summary && <p className="text-sm text-muted-foreground line-clamp-2">{nofo.summary}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Total Funding</p>
                    <p className="font-bold">{formatCurrency(nofo.total_funding_available)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Award Range</p>
                    <p className="font-medium">{formatCurrency(nofo.min_award)} - {formatCurrency(nofo.max_award)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Application window: {formatDateShort(nofo.open_date)} - {formatDateShort(nofo.close_date)}</span>
              </div>
              {nofo.eligible_org_types?.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">Eligible types:</span>
                  {nofo.eligible_org_types.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-muted">{t}</span>
                  ))}
                </div>
              )}
              {nofo.required_documents?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Required Documents:</p>
                  <div className="flex flex-wrap gap-1">
                    {nofo.required_documents.map((doc, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs">
                        {doc.name} {doc.mandatory && <span className="text-red-500">*</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {hasOrg ? (
                <Link to={`/new-application?nofo=${nofo.id}`}>
                  <Button className="w-full">
                    Start Application <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              ) : (
                <div>
                  <Button className="w-full" disabled>Start Application</Button>
                  <p className="text-xs text-amber-600 text-center mt-1">Please contact admin to assign your organization before creating an application.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}