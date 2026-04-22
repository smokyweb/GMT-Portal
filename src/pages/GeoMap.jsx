import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { base44 } from '@/api/base44Client';
import { Map, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '../lib/helpers';
import 'leaflet/dist/leaflet.css';

const STATUS_COLORS = {
  Approved:          { color: '#22c55e', label: 'Active / Approved' },
  Completed:         { color: '#3b82f6', label: 'Completed' },
  Flagged:           { color: '#ef4444', label: 'Compliance Flagged' },
  UnderReview:       { color: '#f59e0b', label: 'Under Review' },
  Submitted:         { color: '#a855f7', label: 'Submitted' },
  RevisionRequested: { color: '#f97316', label: 'Revision Requested' },
  Denied:            { color: '#94a3b8', label: 'Denied' },
  Draft:             { color: '#cbd5e1', label: 'Draft' },
};

async function geocodeLocation(city, state) {
  if (!city && !state) return null;
  const query = [city, state, 'USA'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  return null;
}

export default function GeoMap() {
  const [apps, setApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    Promise.all([
      base44.entities.Application.list('-created_date', 300),
      base44.entities.Organization.list('-created_date', 200),
      base44.entities.ComplianceFlag.filter({ is_resolved: false }, '-created_date', 200),
    ]).then(([a, o, f]) => {
      setApps(a);
      setOrgs(o);
      setFlags(f);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) buildMarkers();
  }, [loading, apps, orgs, flags]);

  const buildMarkers = async () => {
    setGeocoding(true);
    const orgMap = {};
    orgs.forEach(o => { orgMap[o.id] = o; });
    const flaggedAppIds = new Set(flags.map(f => f.application_id));

    // Collect unique city+state combos
    const geoCache = {};
    const appsWithOrg = apps.filter(a => a.organization_id && orgMap[a.organization_id]);

    // Geocode unique city+state pairs
    const uniqueLocations = [...new Set(
      appsWithOrg.map(a => {
        const org = orgMap[a.organization_id];
        return `${org.city || ''}|${org.state || ''}`;
      }).filter(k => k !== '|')
    )];

    await Promise.all(uniqueLocations.map(async key => {
      const [city, state] = key.split('|');
      const coords = await geocodeLocation(city, state);
      if (coords) geoCache[key] = coords;
    }));

    // Build markers with slight random jitter to prevent exact overlap
    const built = appsWithOrg.map(a => {
      const org = orgMap[a.organization_id];
      const key = `${org.city || ''}|${org.state || ''}`;
      const base = geoCache[key];
      if (!base) return null;

      // Determine display status
      const isFlagged = flaggedAppIds.has(a.id);
      const displayStatus = isFlagged ? 'Flagged' : a.status;
      const colorCfg = STATUS_COLORS[displayStatus] || STATUS_COLORS.Draft;

      // Small jitter so stacked markers are visible
      const jitter = () => (Math.random() - 0.5) * 0.05;

      return {
        id: a.id,
        lat: base.lat + jitter(),
        lng: base.lng + jitter(),
        color: colorCfg.color,
        status: displayStatus,
        appNumber: a.application_number,
        orgName: a.organization_name || org.name,
        city: org.city,
        state: org.state,
        county: org.county,
        programCode: a.program_code,
        projectTitle: a.project_title,
        awardedAmount: a.awarded_amount,
        isFlagged,
      };
    }).filter(Boolean);

    setMarkers(built);
    setGeocoding(false);
  };

  const filteredMarkers = useMemo(() => markers.filter(m => {
    if (filterProgram !== 'all' && m.programCode !== filterProgram) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  }), [markers, filterProgram, filterStatus]);

  const programs = useMemo(() => [...new Set(apps.map(a => a.program_code).filter(Boolean))], [apps]);
  const statuses = useMemo(() => [...new Set(markers.map(m => m.status))], [markers]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Grant Map</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Geographic distribution of grant projects by organization location
          </p>
        </div>
        <Button variant="outline" onClick={buildMarkers} disabled={geocoding}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${geocoding ? 'animate-spin' : ''}`} />
          {geocoding ? 'Geocoding…' : 'Refresh Map'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Showing {filteredMarkers.length} of {markers.length} projects
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS)
          .filter(([s]) => statuses.includes(s))
          .map(([s, cfg]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border border-white shadow" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border shadow-sm" style={{ height: '560px' }}>
        {geocoding && markers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            <p className="text-sm">Geocoding organization locations…</p>
          </div>
        ) : (
          <MapContainer
            center={[39.5, -98.35]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredMarkers.map(m => (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lng]}
                radius={m.isFlagged ? 10 : 8}
                pathOptions={{
                  fillColor: m.color,
                  color: m.isFlagged ? '#b91c1c' : '#fff',
                  weight: m.isFlagged ? 2 : 1,
                  opacity: 1,
                  fillOpacity: 0.85,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.97}>
                  <div className="text-xs space-y-0.5 min-w-[160px]">
                    <p className="font-bold text-sm">{m.appNumber || 'Draft'}</p>
                    <p className="text-slate-600">{m.orgName}</p>
                    {m.county && <p className="text-slate-500">{m.county} County, {m.state}</p>}
                    {m.projectTitle && <p className="text-slate-600 truncate max-w-[200px]">{m.projectTitle}</p>}
                    <p>
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.status}
                      </span>
                      {m.programCode && <span className="ml-1 text-slate-500">· {m.programCode}</span>}
                    </p>
                    {m.awardedAmount > 0 && (
                      <p className="text-slate-600 font-medium">Awarded: {formatCurrency(m.awardedAmount)}</p>
                    )}
                    {m.isFlagged && (
                      <p className="text-red-600 font-semibold">⚠ Active Compliance Flag</p>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      {markers.length === 0 && !geocoding && (
        <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
          <Map className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No geocodable data found.</p>
          <p className="text-sm mt-1">Make sure organizations have city and state information set.</p>
        </div>
      )}
    </div>
  );
}