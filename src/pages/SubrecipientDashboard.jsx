import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  FileText, DollarSign, Plus, ChevronRight, Clock, CheckCircle2,
  AlertCircle, Building2, Search, ArrowRight, Inbox, CircleDot
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency, formatDateShort } from '../lib/helpers';

function NofoCard({ nofo, orgType, onApply }) {
  const daysLeft = nofo.close_date
    ? Math.max(0, Math.ceil((new Date(nofo.close_date) - new Date()) / 86400000))
    : null;
  const isEligible =
    !nofo.eligible_org_types?.length || nofo.eligible_org_types.includes(orgType);

  return (
    <div className={`bg-card border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition ${!isEligible ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug">{nofo.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{nofo.program_code || '—'}</span>
            {nofo.grant_number && <span className="text-xs font-mono text-muted-foreground">{nofo.grant_number}</span>}
          </div>
        </div>
        {daysLeft !== null && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${daysLeft <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            {daysLeft}d left
          </span>
        )}
      </div>

      {nofo.summary && (
        <p className="text-xs text-muted-foreground line-clamp-2">{nofo.summary}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-muted-foreground">Max Award</p>
          <p className="font-semibold">{nofo.max_award ? formatCurrency(nofo.max_award) : '—'}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-muted-foreground">Closes</p>
          <p className="font-semibold">{formatDateShort(nofo.close_date) || '—'}</p>
        </div>
      </div>

      {!isEligible ? (
        <p className="text-xs text-muted-foreground text-center py-1">Your organization type is not eligible for this NOFO.</p>
      ) : (
        <Button size="sm" className="w-full mt-1" onClick={() => onApply(nofo)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Start Application
        </Button>
      )}
    </div>
  );
}

function FundingRequestRow({ fr }) {
  const statusColors = {
    Submitted: 'bg-blue-50 text-blue-700',
    UnderReview: 'bg-amber-50 text-amber-700',
    AdditionalInfoRequested: 'bg-orange-50 text-orange-700',
    Approved: 'bg-green-50 text-green-700',
    Denied: 'bg-red-50 text-red-700',
  };
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition">
      <td className="p-3 text-xs font-mono text-muted-foreground">{fr.request_number || '—'}</td>
      <td className="p-3 text-sm font-medium">{fr.request_type}</td>
      <td className="p-3 text-sm">{formatCurrency(fr.amount_requested)}</td>
      <td className="p-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[fr.status] || 'bg-muted text-muted-foreground'}`}>
          {fr.status}
        </span>
      </td>
      <td className="p-3 text-xs text-muted-foreground">{formatDateShort(fr.created_date)}</td>
    </tr>
  );
}

export default function SubrecipientDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [nofos, setNofos] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [fundingRequests, setFundingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      const [openNofos, apps, frs] = await Promise.all([
        base44.entities.Nofo.filter({ status: 'Published' }, '-open_date', 20),
        u.organization_id
          ? base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 50)
          : Promise.resolve([]),
        u.organization_id
          ? base44.entities.FundingRequest.filter({ organization_id: u.organization_id }, '-created_date', 50)
          : Promise.resolve([]),
      ]);
      // Fetch org for eligibility check
      if (u.organization_id) {
        const orgs = await base44.entities.Organization.filter({ id: u.organization_id });
        setOrg(orgs[0] || null);
      }
      setNofos(openNofos);
      setMyApps(apps);
      setFundingRequests(frs);
      setLoading(false);
    })();
  }, []);

  const handleApply = (nofo) => {
    navigate(`/new-application?nofo_id=${nofo.id}`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user?.organization_id) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold mb-2">Organization Profile Required</h2>
      <p className="text-muted-foreground mb-4 max-w-md">Set up your organization profile to view open NOFOs and apply for funding.</p>
      <Link to="/my-organization"><Button>Set Up Organization</Button></Link>
    </div>
  );

  const filteredNofos = nofos.filter(n =>
    !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.program_code?.toLowerCase().includes(search.toLowerCase())
  );

  const draftApps = myApps.filter(a => a.status === 'Draft');
  const activeApps = myApps.filter(a => !['Draft', 'Denied'].includes(a.status));
  const pendingFRs = fundingRequests.filter(fr => ['Submitted', 'UnderReview', 'AdditionalInfoRequested'].includes(fr.status));

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grants Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Find open opportunities, apply for funding, and track your requests</p>
        </div>
        <div className="flex gap-2">
          <Link to="/subrecipient-portal">
            <Button variant="outline" size="sm">Full Portal <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
          </Link>
          <Link to="/my-funding-requests?new=1">
            <Button size="sm"><DollarSign className="h-4 w-4 mr-1.5" /> New Funding Request</Button>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Open NOFOs', value: nofos.length, icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: 'My Applications', value: activeApps.length, icon: CircleDot, color: 'bg-purple-50 text-purple-600' },
          { label: 'Draft Applications', value: draftApps.length, icon: Clock, color: 'bg-amber-50 text-amber-600' },
          { label: 'Pending Requests', value: pendingFRs.length, icon: DollarSign, color: pendingFRs.length > 0 ? 'bg-green-50 text-green-600' : 'bg-muted text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Open NOFOs */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Open NOFOs
            </h2>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring w-44"
                placeholder="Search NOFOs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredNofos.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No open NOFOs right now</p>
              <p className="text-xs mt-1">Check back soon for new funding opportunities.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredNofos.map(nofo => (
                <NofoCard key={nofo.id} nofo={nofo} orgType={org?.type} onApply={handleApply} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: My Applications + Funding Requests */}
        <div className="lg:col-span-2 space-y-6">

          {/* My Applications */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-primary" /> My Applications
              </h2>
              <Link to="/my-applications">
                <Button variant="ghost" size="sm" className="text-xs h-7">View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>
            {myApps.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <p>No applications yet.</p>
                <p className="text-xs mt-1">Apply for an open NOFO to get started.</p>
              </div>
            ) : (
              <div className="divide-y">
                {myApps.slice(0, 6).map(app => (
                  <div key={app.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{app.project_title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{app.application_number || 'Draft'} · {app.program_code}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Funding Requests */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Funding Requests
              </h2>
              <Link to="/my-funding-requests">
                <Button variant="ghost" size="sm" className="text-xs h-7">View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>
            {fundingRequests.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <p>No funding requests yet.</p>
                <Link to="/my-funding-requests?new=1">
                  <Button size="sm" variant="outline" className="mt-2 text-xs">Submit a Request</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs">
                      <th className="text-left p-3 font-medium text-muted-foreground">Req #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundingRequests.slice(0, 6).map(fr => (
                      <FundingRequestRow key={fr.id} fr={fr} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}