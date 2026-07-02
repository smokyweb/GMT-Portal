import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Building2, Tag, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [allApps, setAllApps] = useState([]);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Load all applications once
  useEffect(() => {
    base44.entities.Application.list('-submitted_at', 500).then(setAllApps);
  }, []);

  // Filter on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allApps.filter(app =>
      app.application_number?.toLowerCase().includes(q) ||
      app.organization_name?.toLowerCase().includes(q) ||
      app.program_code?.toLowerCase().includes(q) ||
      app.program_name?.toLowerCase().includes(q)
    ).slice(0, 8);
    setResults(filtered);
  }, [query, allApps]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (app) => {
    setQuery('');
    setOpen(false);
    navigate(`/applications?review=${app.id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  const statusColors = {
    Draft: 'bg-slate-100 text-slate-600',
    Submitted: 'bg-blue-100 text-blue-700',
    PendingReview: 'bg-yellow-100 text-yellow-700',
    UnderReview: 'bg-purple-100 text-purple-700',
    RevisionRequested: 'bg-orange-100 text-orange-700',
    Approved: 'bg-green-100 text-green-700',
    Denied: 'bg-red-100 text-red-700',
  };

  return (
    <div ref={containerRef} className="relative w-64 lg:w-80">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search applications…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full h-9 pl-9 pr-8 text-sm rounded-md border border-input bg-muted/40 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-lg shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No applications found</p>
          ) : (
            <ul>
              {results.map(app => (
                <li key={app.id}>
                  <button
                    onClick={() => handleSelect(app)}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent transition flex items-start gap-3"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono">{app.application_number || 'Draft'}</span>
                        {app.program_code && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{app.program_code}</span>
                        )}
                        {app.status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[app.status] || 'bg-slate-100 text-slate-600'}`}>
                            {app.status?.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        {app.organization_name || ' - '}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}