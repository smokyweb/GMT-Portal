import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, format, parseISO, isValid
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Calendar, List, Download, ExternalLink,
  Flag, FileText, DollarSign, Play, StopCircle, Filter, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EVENT_TYPES = {
  report:             { label: 'Report Due',      color: 'bg-blue-500',   light: 'bg-blue-50 text-blue-800 border-blue-200',     icon: FileText },
  milestone:          { label: 'Milestone',        color: 'bg-violet-500', light: 'bg-violet-50 text-violet-800 border-violet-200', icon: Flag },
  performance_start:  { label: 'Period Start',     color: 'bg-green-500',  light: 'bg-green-50 text-green-800 border-green-200',  icon: Play },
  performance_end:    { label: 'Period End',        color: 'bg-red-500',    light: 'bg-red-50 text-red-800 border-red-200',        icon: StopCircle },
  funding_deadline:   { label: 'Funding Request',  color: 'bg-purple-500', light: 'bg-purple-50 text-purple-800 border-purple-200', icon: DollarSign },
};

const STATUS_DOT = {
  Pending: 'bg-amber-400', Overdue: 'bg-red-500', Submitted: 'bg-blue-400',
  Approved: 'bg-green-500', Denied: 'bg-red-400', UnderReview: 'bg-purple-400',
  Upcoming: 'bg-slate-400', InProgress: 'bg-blue-400', Completed: 'bg-green-500',
  Waived: 'bg-slate-300',
};

function toDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

// ── .ics file generation ───────────────────────────────────────────────────
function toICSDate(date) {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

function buildICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GMT Portal//Grant Timeline//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  events.forEach((ev, i) => {
    const dt = toICSDate(ev.date);
    lines.push(
      'BEGIN:VEVENT',
      `UID:gmt-event-${i}-${ev.id}@gmtportal`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART;VALUE=DATE:${format(ev.date, 'yyyyMMdd')}`,
      `DTEND;VALUE=DATE:${format(addDays(ev.date, 1), 'yyyyMMdd')}`,
      `SUMMARY:${ev.label}`,
      `DESCRIPTION:${[ev.sub, ev.status].filter(Boolean).join(' | ')}`,
      `CATEGORIES:${EVENT_TYPES[ev.type]?.label || ev.type}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadICS(events, filename = 'grant-timeline.ics') {
  const ics = buildICS(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function googleCalendarUrl(ev) {
  const dates = format(ev.date, 'yyyyMMdd') + '/' + format(addDays(ev.date, 1), 'yyyyMMdd');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.label,
    dates,
    details: [ev.sub, ev.status].filter(Boolean).join(' | '),
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}

function outlookCalendarUrl(ev) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.label,
    startdt: format(ev.date, "yyyy-MM-dd"),
    enddt: format(addDays(ev.date, 1), "yyyy-MM-dd"),
    body: [ev.sub, ev.status].filter(Boolean).join(' | '),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params}`;
}

// ── Calendar Sync Dialog ───────────────────────────────────────────────────
function SyncDialog({ events, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Sync to Calendar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Export {events.length} event{events.length !== 1 ? 's' : ''} to your calendar application.</p>

          <button
            onClick={() => downloadICS(events)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition text-left"
          >
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Download className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Download .ics File</p>
              <p className="text-xs text-muted-foreground">Import into Apple Calendar, Outlook, or any app</p>
            </div>
          </button>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Individual Events</p>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {events.slice(0, 30).map((ev, i) => {
                const Ico = EVENT_TYPES[ev.type]?.icon || Calendar;
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                    <Ico className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate text-xs">{ev.label}</span>
                    <span className="text-xs text-muted-foreground">{format(ev.date, 'MMM d')}</span>
                    <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">GCal</Button>
                    </a>
                    <a href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">OL</Button>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── List View ──────────────────────────────────────────────────────────────
function ListView({ events }) {
  const grouped = useMemo(() => {
    const map = {};
    [...events].sort((a, b) => a.date - b.date).forEach(ev => {
      const key = format(ev.date, 'MMMM yyyy');
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  if (events.length === 0) return (
    <div className="text-center py-20 text-muted-foreground">No events match the selected filters.</div>
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, evs]) => (
        <div key={month}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{month}</h3>
          <div className="bg-card rounded-xl border overflow-hidden divide-y">
            {evs.map((ev, i) => {
              const cfg = EVENT_TYPES[ev.type];
              const Ico = cfg?.icon || Calendar;
              return (
                <div key={i} className="flex items-center gap-4 p-3 hover:bg-muted/20 transition">
                  <div className={`w-10 text-center flex-shrink-0`}>
                    <p className="text-xs text-muted-foreground">{format(ev.date, 'MMM')}</p>
                    <p className="text-lg font-bold leading-tight">{format(ev.date, 'd')}</p>
                  </div>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.light}`}>
                    <Ico className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.sub}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg?.light}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[ev.status] || 'bg-slate-400'}`} />
                      {ev.status}
                    </span>
                    <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function GrantTimeline() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [applications, setApplications] = useState([]);
  const [reportSchedules, setReportSchedules] = useState([]);
  const [fundingRequests, setFundingRequests] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterOrg, setFilterOrg] = useState('all');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [showSync, setShowSync] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.Application.filter({ status: 'Approved' }),
      base44.entities.ReportSchedule.list('-due_date', 200),
      base44.entities.FundingRequest.list('-created_date', 200),
      base44.entities.Milestone.list('-due_date', 200),
      base44.entities.Organization.list(),
    ]).then(([u, apps, reports, frs, milests, orgs]) => {
      setUser(u);
      setApplications(apps);
      setReportSchedules(reports);
      setFundingRequests(frs);
      setMilestones(milests);
      setOrganizations(orgs);
      setLoading(false);
    });
  }, []);

  const events = useMemo(() => {
    const list = [];

    reportSchedules.forEach(r => {
      const d = toDate(r.due_date);
      if (!d) return;
      list.push({ date: d, type: 'report', label: `${r.report_type} Report`, sub: r.organization_name || r.application_number, status: r.status, org_name: r.organization_name, id: r.id });
    });

    applications.forEach(a => {
      const start = toDate(a.performance_start);
      const end = toDate(a.performance_end);
      if (start) list.push({ date: start, type: 'performance_start', label: `Period Start: ${a.application_number}`, sub: a.organization_name, status: a.status, org_name: a.organization_name, id: a.id });
      if (end) list.push({ date: end, type: 'performance_end', label: `Period End: ${a.application_number}`, sub: a.organization_name, status: a.status, org_name: a.organization_name, id: a.id });
    });

    fundingRequests.forEach(fr => {
      const d = toDate(fr.period_end);
      if (!d) return;
      list.push({ date: d, type: 'funding_deadline', label: `Funding Req: ${fr.request_number || fr.request_type}`, sub: fr.organization_name, status: fr.status, org_name: fr.organization_name, id: fr.id });
    });

    milestones.forEach(m => {
      const d = toDate(m.due_date);
      if (!d) return;
      list.push({ date: d, type: 'milestone', label: m.title, sub: m.organization_name, status: m.status, org_name: m.organization_name, id: m.id });
    });

    return list;
  }, [applications, reportSchedules, fundingRequests, milestones]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterOrg !== 'all' && e.org_name !== filterOrg) return false;
      return true;
    });
  }, [events, filterType, filterOrg]);

  // unique orgs from events
  const orgNames = useMemo(() => {
    const names = [...new Set(events.map(e => e.org_name).filter(Boolean))].sort();
    return names;
  }, [events]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = [];
  let d = gridStart;
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1); }

  function eventsOnDay(day) {
    return filteredEvents.filter(e => isSameDay(e.date, day));
  }

  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  const upcomingEvents = useMemo(() =>
    filteredEvents
      .filter(e => { const diff = (e.date - new Date()) / 86400000; return diff >= 0 && diff <= 30; })
      .sort((a, b) => a.date - b.date)
      .slice(0, 10),
    [filteredEvents]
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grant Timeline</h1>
          <p className="text-muted-foreground text-sm mt-1">All milestones, reports, and deadlines across grants</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${viewMode === 'calendar' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
            >
              <Calendar className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-muted'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSync(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync to Calendar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {/* Org filter */}
        {orgNames.length > 1 && (
          <Select value={filterOrg} onValueChange={setFilterOrg}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue placeholder="All Organizations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {orgNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Type filters */}
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${filterType === 'all' ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
        >All</button>
        {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilterType(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${filterType === key ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
          >
            <span className={`w-2 h-2 rounded-full ${cfg.color}`} />{cfg.label}
          </button>
        ))}

        <span className="ml-auto text-xs text-muted-foreground">{filteredEvents.length} events</span>
      </div>

      {/* LIST VIEW */}
      {viewMode === 'list' && <ListView events={filteredEvents} />}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="xl:col-span-2 bg-card rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-base">{format(currentMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const dayEvents = eventsOnDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const inMonth = isSameMonth(day, currentMonth);
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[80px] p-1.5 border-b border-r cursor-pointer transition
                      ${!inMonth ? 'bg-muted/30' : 'bg-card hover:bg-muted/20'}
                      ${isSelected ? 'ring-2 ring-inset ring-primary' : ''}`}
                  >
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                      ${isToday ? 'bg-primary text-white' : inMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, j) => (
                        <div key={j} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate border ${EVENT_TYPES[ev.type]?.light}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[ev.status] || 'bg-slate-400'}`} />
                          <span className="truncate">{ev.label}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Selected day detail */}
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">
                  {selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a day'}
                </h3>
              </div>
              <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                {!selectedDay && <div className="text-sm text-muted-foreground text-center py-8">Click on a day to see events</div>}
                {selectedDay && selectedEvents.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No events on this day</div>}
                {selectedEvents.map((ev, i) => {
                  const cfg = EVENT_TYPES[ev.type];
                  const Ico = cfg?.icon || Calendar;
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${cfg?.light}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Ico className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs font-semibold flex-1">{cfg?.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/60`}>{ev.status}</span>
                      </div>
                      <p className="text-sm font-medium">{ev.label}</p>
                      {ev.sub && <p className="text-xs opacity-70 mt-0.5 truncate">{ev.sub}</p>}
                      <div className="flex gap-1 mt-2">
                        <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 bg-white/40">GCal</Button>
                        </a>
                        <a href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 bg-white/40">Outlook</Button>
                        </a>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 bg-white/40" onClick={() => downloadICS([ev])}>
                          <Download className="h-3 w-3 mr-1" />.ics
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming 30 days */}
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="p-4 border-b">
                <p className="text-sm font-semibold">Upcoming (30 days)</p>
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {upcomingEvents.map((ev, i) => {
                  const Ico = EVENT_TYPES[ev.type]?.icon || Calendar;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${EVENT_TYPES[ev.type]?.light}`}>
                        <Ico className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{ev.label}</p>
                        <p className="text-[10px] text-muted-foreground">{format(ev.date, 'MMM d')} · {ev.sub}</p>
                      </div>
                    </div>
                  );
                })}
                {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No upcoming events in 30 days</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Dialog */}
      {showSync && <SyncDialog events={filteredEvents} onClose={() => setShowSync(false)} />}
    </div>
  );
}