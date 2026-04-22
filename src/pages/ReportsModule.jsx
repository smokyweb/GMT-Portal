import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Play, Pencil, Trash2, Copy, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REPORT_TEMPLATES, SUBRECIPIENT_TEMPLATES } from '../lib/reportDataSources';
import { formatDateShort, isSubrecipient } from '../lib/helpers';
import moment from 'moment';

export default function ReportsModule() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const reports = await base44.entities.SavedReport.filter(
        { created_by: u.email },
        '-updated_date',
        100
      );
      setSavedReports(reports.filter(r => !r.is_template));
      setLoading(false);
    });
  }, []);

  const isSub = isSubrecipient(user?.role);
  const templates = isSub ? SUBRECIPIENT_TEMPLATES : REPORT_TEMPLATES;

  const openBuilder = (config = {}) => {
    sessionStorage.setItem('reportBuilderConfig', JSON.stringify({
      report_name: 'Untitled Report',
      data_source: '',
      selected_fields: [],
      filters: [],
      filter_logic: 'AND',
      group_by: [],
      sort_rules: [],
      ...config,
    }));
    navigate('/report-builder');
  };

  const openTemplate = (tpl) => {
    const { id, description, icon, ...config } = tpl;
    openBuilder(config);
  };

  const openSaved = (report) => {
    openBuilder(report);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this saved report?')) return;
    await base44.entities.SavedReport.delete(id);
    setSavedReports(prev => prev.filter(r => r.id !== id));
  };

  const handleDuplicate = async (report) => {
    const { id, created_date, updated_date, created_by, ...rest } = report;
    const copy = await base44.entities.SavedReport.create({ ...rest, report_name: rest.report_name + ' (Copy)' });
    setSavedReports(prev => [copy, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isSub ? 'My Reports' : 'Reports'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Build, run, save and export ad hoc reports</p>
        </div>
        <Button onClick={() => openBuilder()}>
          <Plus className="h-4 w-4 mr-1" /> New Report
        </Button>
      </div>

      {/* Saved Reports */}
      <section>
        <h2 className="text-base font-semibold mb-3">My Saved Reports</h2>
        {savedReports.length === 0 ? (
          <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No saved reports yet.</p>
            <p className="text-sm mt-1">Create your first report below or pick a template to get started.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Report Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Data Source</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Last Run</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {savedReports.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                    <td className="p-3 font-medium">{r.report_name}</td>
                    <td className="p-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{r.data_source}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {r.last_run_at ? (
                        <span>{moment(r.last_run_at).fromNow()} · {r.last_run_row_count ?? 0} rows</span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDateShort(r.created_date)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openSaved(r)}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Run
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openSaved(r)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(r)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Templates */}
      <section>
        <h2 className="text-base font-semibold mb-1">Report Templates</h2>
        <p className="text-sm text-muted-foreground mb-4">Pre-built reports ready to run — click any to open in the builder.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => openTemplate(tpl)}
              className="text-left bg-card border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition group"
            >
              <div className="text-2xl mb-2">{tpl.icon}</div>
              <p className="font-semibold text-sm group-hover:text-primary transition">{tpl.report_name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tpl.description}</p>
              <div className="mt-3">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {tpl.data_source}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}