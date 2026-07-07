import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Download } from 'lucide-react';
import moment from 'moment';
import { Button } from '@/components/ui/button';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    base44.entities.AuditLog.list('-created_date', 500).then(l => { setLogs(l); setLoading(false); });
  }, []);

  const exportCsv = () => {
    const headers = ['Date','User','Action','Entity Type','Description'];
    const escape = v => { const s = String(v ?? ''); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const rows = filtered.map(l => [escape(l.created_date ? l.created_date.substring(0,16).replace('T',' ') : ''),escape(l.user_name||l.user_email||''),escape(l.action||''),escape(l.entity_type||''),escape(l.description||'')].join(','));
    const csv = [headers.join(','),...rows].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='audit-log-'+new Date().toISOString().substring(0,10)+'.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];
  const filtered = logs.filter(l => {
    if (filterEntity !== 'all' && l.entity_type !== filterEntity) return false;
    if (searchTerm && !l.description?.toLowerCase().includes(searchTerm.toLowerCase())
      && !l.user_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete activity history &mdash; {filtered.length} records</p>
        </div>
        {['isc_admin','federal_admin','admin'].includes(user?.role) && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Action</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{moment(log.created_date).format('MMM DD, YYYY h:mm A')}</td>
                  <td className="p-3 font-medium">{log.user_name || log.user_email}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-muted text-xs font-medium">{log.action}</span></td>
                  <td className="p-3 text-xs">{log.entity_type}</td>
                  <td className="p-3 text-muted-foreground max-w-[300px] truncate">{log.description}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No audit log entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}