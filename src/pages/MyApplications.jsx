import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy, Trash2, ChevronDown, ChevronRight, FilePen } from 'lucide-react';
import ApplicationPdfExport from '../components/ApplicationPdfExport';
import DocumentUploadPanel from '../components/DocumentUploadPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '../components/StatusBadge';
import LifecycleProgress from '../components/LifecycleProgress';
import ContextualThread from '../components/ContextualThread';
import ApplicationAuditTab from '../components/ApplicationAuditTab';
import ComplianceChecklist from '../components/ComplianceChecklist';
import ExpenditureBar from '../components/ExpenditureBar';
import { formatCurrency, formatDateShort } from '../lib/helpers';
import BudgetAmendmentDialog from '../components/BudgetAmendmentDialog';
import BudgetAmendmentReview from '../components/BudgetAmendmentReview';
import RfiPanel from '../components/RfiPanel';


function ExpenditureHistory({ applicationId, application }) {
  const [fundingRequests, setFundingRequests] = useState([]);
  const [lineItemsByFR, setLineItemsByFR] = useState({});
  const [expandedFR, setExpandedFR] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) return;
    base44.entities.FundingRequest.filter({ application_id: applicationId }, '-created_date', 100)
      .then(async (frs) => {
        setFundingRequests(frs);
        if (frs.length) {
          const results = await Promise.all(frs.map(fr =>
            base44.entities.FundingRequestLineItem.filter({ funding_request_id: fr.id })
          ));
          const map = {};
          frs.forEach((fr, i) => { map[fr.id] = results[i]; });
          setLineItemsByFR(map);
        }
        setLoading(false);
      });
  }, [applicationId]);

  if (loading) return <div className="flex items-center justify-center p-8"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const totalRequested = fundingRequests.reduce((s, fr) => s + (fr.amount_requested || 0), 0);
  const totalApproved = fundingRequests.filter(fr => fr.status === 'Approved').reduce((s, fr) => s + (fr.amount_approved || 0), 0);
  const totalPaid = fundingRequests.filter(fr => fr.payment_status === 'Paid').reduce((s, fr) => s + (fr.amount_approved || fr.amount_requested || 0), 0);

  // Category breakdown across all line items
  const allLineItems = Object.values(lineItemsByFR).flat();
  const byCategory = allLineItems.reduce((acc, li) => {
    const cat = li.budget_category || 'Other';
    acc[cat] = (acc[cat] || 0) + (Number(li.amount) || 0);
    return acc;
  }, {});

  const PAYMENT_LABELS = {
    PendingDisbursement: 'Pending Disbursement', SubmittedToFinance: 'Submitted to Finance',
    PendingPMApproval: 'Awaiting PM', PendingFOApproval: 'Awaiting FO',
    Paid: 'Paid', PaymentFailed: 'Failed',
  };

  const toggleFR = (id) => setExpandedFR(prev => ({ ...prev, [id]: !prev[id] }));

  if (fundingRequests.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No funding requests submitted for this application yet.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Requested</p>
          <p className="font-bold text-sm mt-0.5">{formatCurrency(totalRequested)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Approved</p>
          <p className="font-bold text-sm mt-0.5 text-green-700">{formatCurrency(totalApproved)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Paid</p>
          <p className="font-bold text-sm mt-0.5 text-blue-700">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Expenditure Rate */}
      {application?.awarded_amount > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Overall Expenditure Rate</span>
            <span>{Math.round(application.expenditure_rate || 0)}% — {formatCurrency(application.total_expended || 0)} of {formatCurrency(application.awarded_amount)}</span>
          </div>
          <ExpenditureBar rate={application.expenditure_rate || 0} />
        </div>
      )}

      {/* Category Breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Spending by Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(byCategory).map(([cat, total]) => (
              <div key={cat} className="bg-muted/40 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-xs font-medium">{cat}</span>
                <span className="text-xs font-bold">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Funding Requests with expandable line items */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Funding Request History</p>
        <div className="space-y-2">
          {fundingRequests.map(fr => {
            const items = lineItemsByFR[fr.id] || [];
            const isExpanded = expandedFR[fr.id];
            return (
              <div key={fr.id} className="rounded-lg border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition text-left"
                  onClick={() => toggleFR(fr.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono">{fr.request_number || fr.id}</p>
                      <p className="text-xs text-muted-foreground">{fr.request_type} · {formatDateShort(fr.created_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-semibold">{formatCurrency(fr.amount_requested)}</span>
                    <StatusBadge status={fr.status} />
                    {fr.payment_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fr.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : fr.payment_status === 'PaymentFailed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                        {PAYMENT_LABELS[fr.payment_status] || fr.payment_status}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-muted/10">
                    {fr.amount_approved != null && (
                      <div className="px-4 py-2 border-b flex gap-6 text-xs text-muted-foreground bg-muted/20">
                        <span>Requested: <strong className="text-foreground">{formatCurrency(fr.amount_requested)}</strong></span>
                        <span>Approved: <strong className="text-green-700">{formatCurrency(fr.amount_approved)}</strong></span>
                        {fr.payment_date && <span>Paid: <strong className="text-blue-700">{formatDateShort(fr.payment_date)}</strong></span>}
                        {fr.payment_reference && <span>Ref: <strong className="text-foreground font-mono">{fr.payment_reference}</strong></span>}
                      </div>
                    )}
                    {fr.reviewer_notes && (
                      <div className="px-4 py-2 border-b bg-amber-50 text-xs text-amber-800">
                        <strong>Reviewer Notes:</strong> {fr.reviewer_notes}
                      </div>
                    )}
                    {items.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Item</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Qty</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Unit Cost</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((li, idx) => (
                            <tr key={li.id || idx} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">{li.budget_category}</span></td>
                              <td className="p-2 max-w-[120px]">
                                <p className="font-medium truncate">{li.expenditure_name || '—'}</p>
                                {li.ael_number && <p className="text-muted-foreground">AEL: {li.ael_number}</p>}
                                {(li.item_manufacturer || li.item_model) && (
                                  <p className="text-muted-foreground truncate">{[li.item_manufacturer, li.item_model].filter(Boolean).join(' · ')}</p>
                                )}
                              </td>
                              <td className="p-2 max-w-[140px] text-muted-foreground truncate">{li.description || li.item_detail_description || '—'}</td>
                              <td className="p-2 text-right">{li.quantity || '—'}</td>
                              <td className="p-2 text-right">{li.unit_cost ? formatCurrency(li.unit_cost) : '—'}</td>
                              <td className="p-2 text-right font-semibold">{formatCurrency(li.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/40 font-bold border-t">
                            <td colSpan={5} className="p-2 text-right text-xs">Request Total</td>
                            <td className="p-2 text-right text-xs">{formatCurrency(items.reduce((s, l) => s + (Number(l.amount) || 0), 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <p className="p-4 text-xs text-muted-foreground text-center">No line items for this request.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MyApplications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [copySource, setCopySource] = useState(null);
  const [nofos, setNofos] = useState([]);
  const [targetNofoId, setTargetNofoId] = useState('');
  const [copying, setCopying] = useState(false);
  const [amendmentApp, setAmendmentApp] = useState(null);
  const [selectedBudgets, setSelectedBudgets] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
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
      grant_number: nofo.grant_number || '',
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
                    <Button variant="ghost" size="sm" onClick={async () => {
                        setSelected(app);
                        const b = await base44.entities.ApplicationBudget.filter({ application_id: app.id });
                        setSelectedBudgets(b);
                      }}>View</Button>
                    <Button variant="ghost" size="sm" onClick={() => openCopyDialog(app)} title="Copy to new grant period">
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    {app.status === 'Approved' && (
                      <Button variant="ghost" size="sm" onClick={() => setAmendmentApp(app)} title="Request budget amendment">
                        <FilePen className="h-3.5 w-3.5 mr-1" /> Amend
                      </Button>
                    )}
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Application {selected?.application_number}</DialogTitle>
              {selected && <ApplicationPdfExport app={selected} budgets={selectedBudgets} />}
            </div>
          </DialogHeader>
          {selected && (
            <>
              <div className="bg-muted/40 rounded-xl p-4 mb-2">
                <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">Application Progress</p>
                <LifecycleProgress status={selected.status} type="application" />
              </div>
            <Tabs defaultValue="details">
              <TabsList className="mb-4 flex-wrap h-auto">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="expenditures">Expenditures</TabsTrigger>
                <TabsTrigger value="rfi">RFIs</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="amendments">Amendments</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
                </TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Application #</p><p className="font-medium font-mono">{selected.application_number || 'Draft'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge status={selected.status} /></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Project Title</p><p className="font-medium">{selected.project_title || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Program</p><p className="font-medium">{selected.program_code || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">NOFO</p><p className="font-medium">{selected.nofo_title || '—'}</p></div>
                  {selected.grant_number && <div><p className="text-xs text-muted-foreground">Grant Number</p><p className="font-medium font-mono">{selected.grant_number}</p></div>}
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
              <TabsContent value="expenditures">
                <ExpenditureHistory applicationId={selected.id} application={selected} />
              </TabsContent>
              <TabsContent value="rfi">
                {user && <RfiPanel
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  user={user}
                  isAdmin={false}
                />}
              </TabsContent>
              <TabsContent value="attachments">
                {user && selected && (
                  <DocumentUploadPanel
                    applicationId={selected.id}
                    applicationNumber={selected.application_number}
                    organizationName={selected.organization_name}
                    organizationId={selected.organization_id}
                    user={user}
                  />
                )}
              </TabsContent>
              <TabsContent value="documents">
                {user && <ComplianceChecklist
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  user={user}
                  canUpload={true}
                />}
              </TabsContent>
              <TabsContent value="messages">
                {user && <ContextualThread
                  applicationId={selected.id}
                  applicationNumber={selected.application_number}
                  organizationName={selected.organization_name}
                  programCode={selected.program_code}
                  user={user}
                />}
              </TabsContent>
              <TabsContent value="amendments">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Budget amendment requests submitted for this application.</p>
                    {selected?.status === 'Approved' && (
                      <Button size="sm" variant="outline" onClick={() => { setSelected(null); setAmendmentApp(selected); }}>
                        <FilePen className="h-3.5 w-3.5 mr-1.5" /> New Amendment
                      </Button>
                    )}
                  </div>
                  <BudgetAmendmentReview applicationId={selected?.id} isAdmin={false} />
                </div>
              </TabsContent>
              <TabsContent value="audit">
                <ApplicationAuditTab applicationId={selected?.id} />
              </TabsContent>
            </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Amendment Dialog */}
      <BudgetAmendmentDialog
        application={amendmentApp}
        open={!!amendmentApp}
        onClose={() => setAmendmentApp(null)}
        onSubmitted={() => setAmendmentApp(null)}
      />

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