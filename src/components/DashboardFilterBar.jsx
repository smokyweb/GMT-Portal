import { Filter, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appMatchesFY, deriveFYOptions } from '../hooks/useDateRangeFilter';

export const DEFAULT_FILTERS = { fy: 'All', program: 'All', nofo: 'All', status: 'All' };

export function applyDashboardFilters(apps, filters) {
  return apps.filter(a => {
    // Use standardized federal FY logic (Oct 1 - Sep 30)
    if (filters.fy !== 'All' && !appMatchesFY(a, filters.fy)) return false;
    if (filters.program !== 'All' && a.program_code !== filters.program) return false;
    if (filters.nofo !== 'All' && a.nofo_title !== filters.nofo) return false;
    if (filters.status !== 'All' && a.status !== filters.status) return false;
    return true;
  });
}

export default function DashboardFilterBar({ apps, filters, setFilters, isStateView = true, children }) {
  const programs  = [...new Set(apps.map(a => a.program_code).filter(Boolean))].sort();
  const nofos     = [...new Set(apps.map(a => a.nofo_title).filter(Boolean))].sort();
  const fyOptions = deriveFYOptions(apps);
  const hasActive = Object.values(filters).some(v => v !== 'All');

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-xl border">
      <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

      <Select value={filters.fy} onValueChange={v => setFilters(f => ({ ...f, fy: v }))}>
        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Fiscal Year" /></SelectTrigger>
        <SelectContent>{fyOptions.map(y => <SelectItem key={y} value={y}>{y === 'All' ? 'All Years' : y}</SelectItem>)}</SelectContent>
      </Select>

      {isStateView && programs.length > 0 && (
        <Select value={filters.program} onValueChange={v => setFilters(f => ({ ...f, program: v }))}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Program" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {nofos.length > 0 && (
        <Select value={filters.nofo} onValueChange={v => setFilters(f => ({ ...f, nofo: v }))}>
          <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="NOFO" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All NOFOs</SelectItem>
            {nofos.map(n => <SelectItem key={n} value={n}>{n.length > 32 ? n.slice(0, 32) + '…' : n}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {['All', 'Draft', 'Submitted', 'PendingReview', 'UnderReview', 'RevisionRequested', 'Approved', 'Denied'].map(s => (
            <SelectItem key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActive && (
        <button
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition ml-1"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}

      {hasActive && (
        <span className="text-xs text-muted-foreground">
          {applyDashboardFilters(apps, filters).length} result{applyDashboardFilters(apps, filters).length !== 1 ? 's' : ''}
        </span>
      )}

      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}