import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Building2 } from 'lucide-react';
import { formatCurrency } from '../lib/helpers';

export default function OrgDeepDive() {
  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgData, setOrgData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [searchOrg, setSearchOrg] = useState('');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const isFederal = ['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role);

      // Load orgs
      const allOrgs = await base44.entities.Organization.list('-created_date', 500);
      let filteredOrgs = allOrgs;

      if (!isFederal && u.scope_state) {
        filteredOrgs = allOrgs.filter(o => o.state === u.scope_state);
      }

      setOrgs(filteredOrgs);
      if (filteredOrgs.length > 0) {
        setSelectedOrg(filteredOrgs[0]);
        await loadOrgData(filteredOrgs[0].id, filteredOrgs[0].name);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadOrgData = async (orgId, orgName) => {
    setLoadingOrg(true);
    try {
      // Try by organization_id first; fall back to filtering by organization_name
      // (IDs may be in different formats between orgs and related entities)
      const fetchByOrg = async (entity) => {
        try {
          // Load all and match by org_id OR org_name (IDs may use different formats in seeded data)
          const all = await entity.list('-created_date', 500).catch(() => []);
          const items = Array.isArray(all) ? all : [];
          const matched = items.filter(r =>
            r.organization_id === orgId ||
            (orgName && r.organization_name && r.organization_name.toLowerCase().trim() === orgName.toLowerCase().trim())
          );
          return matched;
        } catch { return []; }
      };

      const [apps, frs, docs, flags, messages, milestones] = await Promise.all([
        fetchByOrg(base44.entities.Application),
        fetchByOrg(base44.entities.FundingRequest),
        fetchByOrg(base44.entities.Document),
        fetchByOrg(base44.entities.ComplianceFlag),
        fetchByOrg(base44.entities.Message),
        fetchByOrg(base44.entities.Milestone),
      ]);

      const safeApps = Array.isArray(apps) ? apps : [];
      const safeFrs = Array.isArray(frs) ? frs : [];
      const safeDocs = Array.isArray(docs) ? docs : [];
      const safeFlags = Array.isArray(flags) ? flags : [];
      const safeMessages = Array.isArray(messages) ? messages : [];
      const safeMilestones = Array.isArray(milestones) ? milestones : [];

      const approvedApps = safeApps.filter(a => a.status === 'Approved');
      const totalAwarded = approvedApps.reduce((s, a) => s + (Number(a.awarded_amount) || 0), 0);
      const pendingApps = safeApps.filter(a => a.status === 'Submitted').length;
      const openFlags = safeFlags.filter(f => !f.is_resolved).length;
      const completedDocs = safeDocs.filter(d => d.review_status === 'Approved').length;
      const docCompleteness = safeDocs.length > 0 ? Math.round((completedDocs / safeDocs.length) * 100) : 0;

      setOrgData({
        apps: safeApps, frs: safeFrs, docs: safeDocs,
        flags: safeFlags, messages: safeMessages, milestones: safeMilestones,
        totalAwarded, pendingApps, openFlags, docCompleteness,
      });
    } catch (err) {
      console.error('OrgDeepDive loadOrgData error:', err);
      setOrgData({ apps: [], frs: [], docs: [], flags: [], messages: [], milestones: [], totalAwarded: 0, pendingApps: 0, openFlags: 0, docCompleteness: 0 });
    } finally {
      setLoadingOrg(false);
    }
  };

  const handleSelectOrg = async (org) => {
    setSelectedOrg(org);
    setOrgData({});
    await loadOrgData(org.id, org.name);
  };

  const filteredOrgs = orgs.filter(o =>
    !searchOrg || o.name?.toLowerCase().includes(searchOrg.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Organization Deep Dive</h1>
        <p className="text-muted-foreground text-sm mt-1">Comprehensive view of organization details and all associated records</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Org List Sidebar */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-3 border-b">
            <Input placeholder="Search orgs…" value={searchOrg} onChange={e => setSearchOrg(e.target.value)} className="text-sm" />
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredOrgs.map(org => (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org)}
                className={`w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition ${selectedOrg?.id === org.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
              >
                <p className="font-medium text-sm">{org.name}</p>
                <p className="text-xs text-muted-foreground">{org.type}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Org Details */}
        <div className="lg:col-span-3 space-y-4">
          {loadingOrg && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading organization data…</span>
            </div>
          )}
          {selectedOrg && !loadingOrg && (
            <>
              {/* Header */}
              <div className="bg-card border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{selectedOrg.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedOrg.type} | {selectedOrg.state}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  {[
                    { label: 'EIN', value: selectedOrg.ein },
                    { label: 'SAM UEI', value: selectedOrg.sam_uei },
                    { label: 'City', value: selectedOrg.city },
                    { label: 'Zip', value: selectedOrg.zip },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-mono text-sm">{item.value || ' - '}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Awarded', value: formatCurrency(orgData.totalAwarded || 0) },
                  { label: 'Pending Apps', value: orgData.pendingApps || 0 },
                  { label: 'Open Flags', value: orgData.openFlags || 0 },
                  { label: 'Doc Completeness', value: `${orgData.docCompleteness || 0}%` },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-lg font-bold">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="applications">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="applications">Apps ({orgData.apps?.length || 0})</TabsTrigger>
                  <TabsTrigger value="funding">FRs ({orgData.frs?.length || 0})</TabsTrigger>
                  <TabsTrigger value="documents">Docs ({orgData.docs?.length || 0})</TabsTrigger>
                  <TabsTrigger value="flags">Flags ({orgData.flags?.length || 0})</TabsTrigger>
                  <TabsTrigger value="messages">Msgs ({orgData.messages?.length || 0})</TabsTrigger>
                  <TabsTrigger value="milestones">Miles ({orgData.milestones?.length || 0})</TabsTrigger>
                </TabsList>

                {['applications', 'funding', 'documents', 'flags', 'messages', 'milestones'].map(tab => (
                  <TabsContent key={tab} value={tab} className="mt-4">
                    <div className="bg-card border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="text-left p-3 font-medium text-muted-foreground">
                                {tab === 'applications' && 'App #'}
                                {tab === 'funding' && 'Request #'}
                                {tab === 'documents' && 'Document'}
                                {tab === 'flags' && 'Flag Type'}
                                {tab === 'messages' && 'Subject'}
                                {tab === 'milestones' && 'Milestone'}
                              </th>
                              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                              <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(tab === 'applications' ? orgData.apps :
                              tab === 'funding' ? orgData.frs :
                              tab === 'documents' ? orgData.docs :
                              tab === 'flags' ? orgData.flags :
                              tab === 'messages' ? orgData.messages :
                              orgData.milestones)?.slice(0, 10).map((item, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="p-3 text-xs font-mono">
                                  {tab === 'flags'
                                    ? (item.flag_type || '-')
                                    : (item.application_number || item.request_number || item.name || item.subject || item.title || '-')}
                                </td>
                                <td className="p-3 text-xs">
                                  {tab === 'flags'
                                    ? (item.is_resolved ? 'Resolved' : 'Open')
                                    : (item.status || '-')}
                                </td>
                                <td className="p-3 text-xs text-muted-foreground">{item.created_date || item.updated_date ? new Date(item.created_date || item.updated_date).toLocaleDateString() : ' - '}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}