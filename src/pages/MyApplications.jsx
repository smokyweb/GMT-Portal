import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy, Trash2, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '../components/StatusBadge';
import ApplicationAuditTab from '../components/ApplicationAuditTab';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import { jsPDF } from 'jspdf';

export default function MyApplications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [copySource, setCopySource] = useState(null);
  const [nofos, setNofos] = useState([]);
  const [targetNofoId, setTargetNofoId] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (u.organization_id) {
        const a = await base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 50);
        setApps(a);
      }
      setLoading(false);
    });
    base44.entities.Nofo.filter({ status: 'Published' }).then(setNofos);
  }, []);

  const handleDelete = async (app) => {
    if (!window.confirm(`Delete draft "${app.project_title || app.application_number || 'Untitled'}"? This cannot be undone.`)) return;
    await base44.entities.Application.delete(app.id);
    setApps(prev => prev.filter(a => a.id !== app.id));
  };

  const exportPDF = (app) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = 20;

    const line = () => { doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 6; };
    const section = (title) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 90, 160);
      doc.text(title.toUpperCase(), margin, y); y += 2;
      line();
      doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
    };
    const field = (label, value) => {
      if (!value || value === '—') return;
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(8); doc.setTextColor(120); doc.text(label, margin, y); y += 4;
      doc.setFontSize(10); doc.setTextColor(30); 
      const lines = doc.splitTextToSize(String(value), contentW);
      doc.text(lines, margin, y); y += lines.length * 5 + 4;
    };
    const fieldPair = (l1, v1, l2, v2) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const half = contentW / 2;
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(l1, margin, y); doc.text(l2, margin + half + 4, y); y += 4;
      doc.setFontSize(10); doc.setTextColor(30);
      doc.text(String(v1 || '—'), margin, y); doc.text(String(v2 || '—'), margin + half + 4, y); y += 8;
    };

    // Header
    doc.setFillColor(15, 31, 61);
    doc.rect(0, 0, pageW, 14, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255);
    doc.text('GMT Portal — Grant Application', margin, 9.5);
    y = 24;

    section('Application Overview');
    fieldPair('Application #', app.application_number || 'Draft', 'Status', app.status);
    field('Project Title', app.project_title);
    fieldPair('Program', app.program_code, 'NOFO', app.nofo_title);
    fieldPair('Organization', app.organization_name, 'Submitted By', app.submitted_by);
    fieldPair('Submitted Date', formatDateShort(app.submitted_at), 'Version', app.version || 1);

    section('Financial Summary');
    fieldPair('Requested Amount', formatCurrency(app.requested_amount), 'Awarded Amount', app.awarded_amount ? formatCurrency(app.awarded_amount) : '—');
    fieldPair('Match / Cost-Share', formatCurrency(app.match_amount), 'Total Expended', app.total_expended ? formatCurrency(app.total_expended) : '—');

    section('Performance Period');
    fieldPair('Start Date', app.performance_start || '—', 'End Date', app.performance_end || '—');

    if (app.project_narrative) { section('Project Narrative'); field('', app.project_narrative); }
    if (app.work_plan) { section('Work Plan'); field('', app.work_plan); }
    if (app.risk_assessment) { section('Risk Assessment'); field('', app.risk_assessment); }
    if (app.revision_notes) { section('Revision Notes'); field('', app.revision_notes); }

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(160);
      doc.text(`Generated ${new Date().toLocaleDateString()} — GMT Portal`, margin, 290);
      doc.text(`Page ${i} of ${pages}`, pageW - margin, 290, { align: 'right' });
    }

    doc.save(`Application_${app.application_number || app.id}.pdf`);
  };

  const openCopyDialog = (app) => {
    setCopySource(app);
    setTargetNofoId('');
  };

  const handleCopy = async () => {
    if (!targetNofoId) return;
    setCopying(true);
    const nofo = nofos.find(n => n.id === targetNofoId);
    // Create new draft application copying all fields
    const newApp = await base44.entities.Application.create({
      nofo_id: nofo.id,
      nofo_title: nofo.title,
      organization_id: copySource.organization_id,
      organization_name: copySource.organization_name,
      submitted_by: copySource.submitted_by,
      project_title: copySource.project_title,
      project_narrative: copySource.project_narrative,
      work_plan: copySource.work_plan,
      risk_assessment: copySource.risk_assessment,
      requested_amount: copySource.requested_amount,
      match_amount: copySource.match_amount,
      program_code: nofo.program_code || copySource.program_code,
      program_name: nofo.program_name || copySource.program_name,
      status: 'Draft',
      version: 1,
    });
    // Copy budget items
    const budgetItems = await base44.entities.ApplicationBudget.filter({ application_id: copySource.id });
    await Promise.all(budgetItems.map(b =>
      base44.entities.ApplicationBudget.create({
        application_id: newApp.id,
        budget_category: b.budget_category,
        line_description: b.line_description,
        amount_requested: b.amount_requested,
        amount_match: b.amount_match,
        is_allowable: true,
      })
    ));
    setCopying(false);
    setCopySource(null);
    navigate(`/new-application?id=${newApp.id}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">{apps.length} applications</p>
        </div>
        <Link to="/browse-nofos"><Button>New Application</Button></Link>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">App #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Requested</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Awarded</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{app.application_number || 'Draft'}</td>
                  <td className="p-3 font-medium">{app.project_title || 'Untitled'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{app.program_code || '—'}</span></td>
                  <td className="p-3 text-right">{formatCurrency(app.requested_amount)}</td>
                  <td className="p-3 text-right font-medium">{app.awarded_amount ? formatCurrency(app.awarded_amount) : '—'}</td>
                  <td className="p-3"><StatusBadge status={app.status} /></td>
                  <td className="p-3 flex gap-1 flex-wrap">
                    {(app.status === 'Draft' || app.status === 'RevisionRequested') && (
                      <Link to={`/new-application?id=${app.id}`}><Button variant="ghost" size="sm">Edit</Button></Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSelected(app)}>View</Button>
                    <Button variant="ghost" size="sm" onClick={() => openCopyDialog(app)} title="Copy to new grant period">
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                    {app.status === 'Draft' && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(app)} title="Delete draft">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No applications yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Application Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Application {selected?.application_number}</DialogTitle>
              <Button variant="outline" size="sm" onClick={() => exportPDF(selected)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
              </Button>
            </div>
          </DialogHeader>
          {selected && (
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Application #</p><p className="font-medium font-mono">{selected.application_number || 'Draft'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={selected.status} /></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Project Title</p><p className="font-medium">{selected.project_title || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Program</p><p className="font-medium">{selected.program_code || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">NOFO</p><p className="font-medium">{selected.nofo_title || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Requested Amount</p><p className="font-semibold">{formatCurrency(selected.requested_amount)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Awarded Amount</p><p className="font-semibold">{selected.awarded_amount ? formatCurrency(selected.awarded_amount) : '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Match / Cost-Share</p><p className="font-medium">{formatCurrency(selected.match_amount)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total Expended</p><p className="font-medium">{selected.total_expended ? formatCurrency(selected.total_expended) : '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Performance Start</p><p className="font-medium">{selected.performance_start || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Performance End</p><p className="font-medium">{selected.performance_end || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{formatDateShort(selected.submitted_at)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Submitted By</p><p className="font-medium">{selected.submitted_by || '—'}</p></div>
                </div>
                {selected.project_narrative && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Project Narrative</p>
                    <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{selected.project_narrative}</p>
                  </div>
                )}
                {selected.work_plan && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Work Plan</p>
                    <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{selected.work_plan}</p>
                  </div>
                )}
                {selected.revision_notes && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-orange-700 font-semibold">Revision Notes</p>
                    <p className="text-sm text-orange-800 mt-1">{selected.revision_notes}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="audit">
                <ApplicationAuditTab applicationId={selected?.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Copy to New Period Dialog */}
      <Dialog open={!!copySource} onOpenChange={() => setCopySource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4" /> Copy to New Grant Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Copying <strong>{copySource?.project_title || copySource?.application_number}</strong>. All project details and budget lines will be pre-filled. You'll be able to review and update everything before submitting.
            </div>
            <div>
              <Label>Select Target NOFO (New Grant Period) <span className="text-red-500">*</span></Label>
              <Select value={targetNofoId} onValueChange={setTargetNofoId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a published NOFO…" /></SelectTrigger>
                <SelectContent>
                  {nofos.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title} {n.program_code ? `(${n.program_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {nofos.length === 0 && <p className="text-xs text-muted-foreground mt-1">No published NOFOs available.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopySource(null)}>Cancel</Button>
            <Button onClick={handleCopy} disabled={copying || !targetNofoId}>
              {copying ? 'Creating…' : 'Create Copy & Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}