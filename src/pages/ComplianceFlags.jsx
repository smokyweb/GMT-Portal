import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, Search, X, ExternalLink, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SeverityBadge from '../components/SeverityBadge';
import { formatDateShort, logAudit } from '../lib/helpers';
import { onComplianceFlagResolved } from '../lib/workflowEngine';
import ComplianceFlagDetail from '../components/ComplianceFlagDetail';
import ComplianceTrendsDashboard from '../components/ComplianceTrendsDashboard';

const PAGE_SIZE = 10;

const FLAG_TYPES = [
  'OverdueReport',
  'MissingDocument',
  'FinancialDiscrepancy',
  'MatchShortfall',
];

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export default function ComplianceFlags() {
  const [flags, setFlags] = useState([]);
  const [appMap, setAppMap] = useState({});
  const [orgMap, setOrgMap] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Selection
  const [selected, setSelected] = useState(new Set());
  const [bulkResolving, setBulkResolving] = useState(false);

  // Resolve dialog
  const [resolvingFlag, setResolvingFlag] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  // Pagination
  const [openPage, setOpenPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      const [allFlags, u, apps, orgs] = await Promise.all([
        base44.entities.ComplianceFlag.list('-created_date', 200),
        base44.auth.me(),
        base44.entities.Application.list('-created_date', 500),
        base44.entities.Organization.list(),
      ]);
      setUser(u);

      // Build app map (appNumber -> id)
      const am = {};
      apps.forEach(a => { if (a.application_number) am[a.application_number] = a.id; });
      setAppMap(am);

      // Build org map (name -> id)
      const om = {};
      orgs.forEach(o => { if (o.name) om[o.name] = o.id; });
      setOrgMap(om);

      // Scope filter: state users only see flags for their state's orgs
      let visibleFlags = allFlags;
      if (u?.scope_state) {
        const scopedOrgIds = new Set(orgs.filter(o => o.state === u.scope_state).map(o => o.id));
        const scopedAppIds = new Set(apps.filter(a => scopedOrgIds.has(a.organization_id)).map(a => a.id));
        visibleFlags = allFlags.filter(f => scopedAppIds.has(f.application_id));
      }
      setFlags(visibleFlags);
      setLoading(false);
    };
    loadData();
  }, []);

  const openResolveDialog = (flag) => {
    setResolvingFlag(flag);
    setResolveNotes('');
  };

  const handleResolveConfirm = async () => {
    setResolving(true);
    await resolve(resolvingFlag, resolveNotes);
    setResolving(false);
    setResolvingFlag(null);
    setResolveNotes('');
  };

  const resolve = async (flag, notes = '') => {
    const update = {
      is_resolved: true,
      resolved_by: user.email,
      resolved_at: new Date().toISOString(),
      ...(notes ? { resolution_notes: notes } : {}),
    };
    await base44.entities.ComplianceFlag.update(flag.id, update);
    await logAudit(base44, user, 'Resolved', 'ComplianceFlag', flag.id, `Resolved: ${flag.description}${notes ? ` | Notes: ${notes}` : ''}`);
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, ...update } : f));
    await onComplianceFlagResolved(base44, flag.application_id);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (pageFlags) => {
    const pageIds = pageFlags.map(f => f.id);
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const bulkResolve = async () => {
    setBulkResolving(true);
    const toResolve = flags.filter(f => selected.has(f.id) && !f.is_resolved);
    await Promise.all(toResolve.map(async flag => {
      const update = { is_resolved: true, resolved_by: user.email, resolved_at: new Date().toISOString() };
      await base44.entities.ComplianceFlag.update(flag.id, update);
      await logAudit(base44, user, 'Resolved', 'ComplianceFlag', flag.id, `Bulk resolved: ${flag.description}`);
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, ...update } : f));
    }));
    await Promise.all(toResolve.map(f => onComplianceFlagResolved(base44, f.application_id)));
    setSelected(new Set());
    setBulkResolving(false);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterSeverity('all');
    setFilterType('all');
    setOpenPage(1);
    setResolvedPage(1);
  };

  const hasActiveFilters = search || filterSeverity !== 'all' || filterType !== 'all';

  const applyFilters = (list) => list.filter(f => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterType !== 'all' && f.flag_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.organization_name?.toLowerCase().includes(q) ||
        f.application_number?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const allOpen = applyFilters(flags.filter(f => !f.is_resolved));
  const allResolved = applyFilters(flags.filter(f => f.is_resolved));
  const totalOpen = flags.filter(f => !f.is_resolved).length;
  const totalResolved = flags.filter(f => f.is_resolved).length;

  const openTotalPages = Math.max(1, Math.ceil(allOpen.length / PAGE_SIZE));
  const resolvedTotalPages = Math.max(1, Math.ceil(allResolved.length / PAGE_SIZE));
  const open = allOpen.slice((openPage - 1) * PAGE_SIZE, openPage * PAGE_SIZE);
  const resolved = allResolved.slice((resolvedPage - 1) * PAGE_SIZE, resolvedPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Flags</h1>
        <p className="text-muted-foreground text-sm mt-1">{totalOpen} open flags, {totalResolved} resolved</p>
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="trends">Trends Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4">
          <ComplianceTrendsDashboard />
        </TabsContent>

        <TabsContent value="flags" className="mt-4 space-y-6">

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search organization, app #, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="All Flag Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Flag Types</SelectItem>
            {FLAG_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Open Flags */}
      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={open.length > 0 && open.every(f => selected.has(f.id))}
              onCheckedChange={() => toggleSelectAll(open)}
              aria-label="Select all on this page"
            />
            <h2 className="font-semibold">Open Flags</h2>
            <span className="text-sm text-muted-foreground">
              {open.length !== totalOpen ? `${open.length} of ${totalOpen}` : open.length}
            </span>
          </div>
          {selected.size > 0 && (
            <Button size="sm" onClick={bulkResolve} disabled={bulkResolving} className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {bulkResolving ? 'Resolving…' : `Resolve ${selected.size} Selected`}
            </Button>
          )}
        </div>
        <div className="divide-y">
          {open.map(flag => (
            <div
              key={flag.id}
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition cursor-pointer"
              onClick={() => setSelectedFlag(flag)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(flag.id)}
                  onCheckedChange={() => toggleSelect(flag.id)}
                  onClick={e => e.stopPropagation()}
                  className="mt-0.5"
                />
                <SeverityBadge severity={flag.severity} />
                <div>
                  <p className="text-sm font-medium">{flag.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-1">
                    <span>{flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {flag.organization_name && (
                      <>
                        <span>•</span>
                        <Link
                          to="/organizations"
                          onClick={e => e.stopPropagation()}
                          className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          {flag.organization_name}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </>
                    )}
                    {flag.application_number && (
                      <>
                        <span>•</span>
                        <Link
                          to={`/applications${appMap[flag.application_number] ? `?review=${appMap[flag.application_number]}` : ''}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          {flag.application_number}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); openResolveDialog(flag); }}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
              </Button>
            </div>
          ))}
          {open.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters ? 'No flags match your filters.' : 'No open flags'}
            </p>
          )}
        </div>
        {openTotalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-muted-foreground">
            <span>Page {openPage} of {openTotalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={openPage === 1} onClick={() => setOpenPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={openPage === openTotalPages} onClick={() => setOpenPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Resolved Flags */}
      {(resolved.length > 0 || (hasActiveFilters && totalResolved > 0)) && (
        <div className="bg-card rounded-xl border">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-semibold text-muted-foreground">Resolved</h2>
            <span className="text-sm text-muted-foreground">
              {resolved.length !== totalResolved ? `${resolved.length} of ${totalResolved}` : resolved.length}
            </span>
          </div>
          <div className="divide-y">
            {resolved.map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-4 opacity-60 cursor-pointer hover:bg-muted/20 transition" onClick={() => setSelectedFlag(flag)}>
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={flag.severity} />
                  <div>
                    <p className="text-sm font-medium line-through">{flag.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-1">
                      <span>{flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                      {flag.organization_name && (
                        <>
                          <span>•</span>
                          <Link
                            to="/organizations"
                            className="font-medium text-primary/70 hover:underline inline-flex items-center gap-0.5"
                          >
                            {flag.organization_name}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </>
                      )}
                      {flag.application_number && (
                        <>
                          <span>•</span>
                          <Link
                            to={`/applications${appMap[flag.application_number] ? `?review=${appMap[flag.application_number]}` : ''}`}
                            className="font-mono text-primary/70 hover:underline inline-flex items-center gap-0.5"
                          >
                            {flag.application_number}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Resolved by {flag.resolved_by} on {formatDateShort(flag.resolved_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {resolved.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No resolved flags match your filters.</p>
            )}
          </div>
          {resolvedTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-muted-foreground">
              <span>Page {resolvedPage} of {resolvedTotalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={resolvedPage === 1} onClick={() => setResolvedPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={resolvedPage === resolvedTotalPages} onClick={() => setResolvedPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolvingFlag} onOpenChange={open => { if (!open) { setResolvingFlag(null); setResolveNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Compliance Flag</DialogTitle>
          </DialogHeader>
          {resolvingFlag && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={resolvingFlag.severity} />
                  <span className="text-xs text-muted-foreground">{resolvingFlag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
                <p className="font-medium">{resolvingFlag.description}</p>
                {resolvingFlag.organization_name && <p className="text-xs text-muted-foreground">{resolvingFlag.organization_name}{resolvingFlag.application_number ? ` • ${resolvingFlag.application_number}` : ''}</p>}
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="Describe how this issue was resolved..."
                  value={resolveNotes}
                  onChange={e => setResolveNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolvingFlag(null); setResolveNotes(''); }}>Cancel</Button>
            <Button onClick={handleResolveConfirm} disabled={resolving}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {resolving ? 'Resolving…' : 'Confirm Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComplianceFlagDetail
        flag={selectedFlag}
        appMap={appMap}
        onClose={() => setSelectedFlag(null)}
        onResolve={resolve}
      />

        </TabsContent>
      </Tabs>
    </div>
  );
}