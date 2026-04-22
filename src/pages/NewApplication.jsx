import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight, Upload, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency, logAudit, createNotification } from '../lib/helpers';

const BUDGET_CATEGORIES = ['Personnel', 'Equipment', 'Training', 'Travel', 'Contractual', 'Planning', 'Other'];
const STEPS = ['Organization', 'Project Details', 'Budget', 'Documents', 'Review & Submit'];

export default function NewApplication() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const nofoId = urlParams.get('nofo');
  const appId = urlParams.get('id');

  const [step, setStep] = useState(0);
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [nofo, setNofo] = useState(null);
  const [app, setApp] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    project_title: '', project_narrative: '', work_plan: '', risk_assessment: '',
    requested_amount: 0, match_amount: 0, performance_start: '', performance_end: '',
  });

  const [orgForm, setOrgForm] = useState({
    name: '', type: 'Municipality', ein: '', sam_uei: '', address: '', city: '', state: '', zip: '', county: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);

    if (u.organization_id) {
      const orgs = await base44.entities.Organization.filter({ id: u.organization_id });
      if (orgs.length > 0) {
        setOrg(orgs[0]);
        setOrgForm(orgs[0]);
      }
    }

    if (appId) {
      const apps = await base44.entities.Application.filter({ id: appId });
      if (apps.length > 0) {
        setApp(apps[0]);
        setForm({
          project_title: apps[0].project_title || '',
          project_narrative: apps[0].project_narrative || '',
          work_plan: apps[0].work_plan || '',
          risk_assessment: apps[0].risk_assessment || '',
          requested_amount: apps[0].requested_amount || 0,
          match_amount: apps[0].match_amount || 0,
          performance_start: apps[0].performance_start || '',
          performance_end: apps[0].performance_end || '',
        });
        if (apps[0].nofo_id) {
          const nofos = await base44.entities.Nofo.filter({ id: apps[0].nofo_id });
          if (nofos.length > 0) setNofo(nofos[0]);
        }
        const b = await base44.entities.ApplicationBudget.filter({ application_id: apps[0].id });
        setBudgetItems(b.map(bi => ({ ...bi, isExisting: true })));
      }
    } else if (nofoId) {
      const nofos = await base44.entities.Nofo.filter({ id: nofoId });
      if (nofos.length > 0) setNofo(nofos[0]);
    }

    setLoading(false);
  };

  const saveDraft = async () => {
    setSaving(true);
    const data = {
      ...form,
      nofo_id: nofo?.id || app?.nofo_id,
      nofo_title: nofo?.title || app?.nofo_title,
      organization_id: org?.id || user?.organization_id,
      organization_name: orgForm.name || org?.name,
      submitted_by: user?.email,
      program_code: nofo?.program_code || app?.program_code,
      program_name: nofo?.program_name || app?.program_name,
      status: 'Draft',
      requested_amount: Number(form.requested_amount),
      match_amount: Number(form.match_amount),
      version: (app?.version || 0) + 1,
    };

    let savedApp;
    if (app) {
      await base44.entities.Application.update(app.id, data);
      savedApp = { ...app, ...data };
    } else {
      savedApp = await base44.entities.Application.create(data);
    }
    setApp(savedApp);

    // Save budget items
    for (const item of budgetItems) {
      if (item.isExisting && item.id) {
        await base44.entities.ApplicationBudget.update(item.id, {
          budget_category: item.budget_category,
          line_description: item.line_description,
          amount_requested: Number(item.amount_requested),
          amount_match: Number(item.amount_match),
        });
      } else if (!item.isExisting) {
        const created = await base44.entities.ApplicationBudget.create({
          application_id: savedApp.id,
          budget_category: item.budget_category,
          line_description: item.line_description,
          amount_requested: Number(item.amount_requested),
          amount_match: Number(item.amount_match),
          is_allowable: true,
        });
        item.id = created.id;
        item.isExisting = true;
      }
    }

    // Update org if changed
    if (org) {
      await base44.entities.Organization.update(org.id, orgForm);
    }

    setSaving(false);
  };

  const submitApplication = async () => {
    setSaving(true);
    await saveDraft();

    const allApps = await base44.entities.Application.list('-created_date', 1000);
    const appNum = `APP-${new Date().getFullYear()}-${String(allApps.length + 1).padStart(5, '0')}`;

    await base44.entities.Application.update(app.id, {
      status: 'Submitted',
      application_number: appNum,
      submitted_at: new Date().toISOString(),
    });

    // Notify state reviewers
    const users = await base44.entities.User.list();
    const reviewers = users.filter(u => u.role === 'admin' || u.role === 'reviewer');
    for (const r of reviewers) {
      await createNotification(base44, r.email, 'New Application Submitted',
        `${orgForm.name} submitted application ${appNum} for ${nofo?.title || 'a grant'}.`,
        'app_submitted', 'Application', app.id, '/applications');
    }

    await logAudit(base44, user, 'Submitted', 'Application', app.id, `Submitted application ${appNum}`);
    setSaving(false);
    navigate('/my-applications');
  };

  const addBudgetItem = () => {
    setBudgetItems(prev => [...prev, { budget_category: 'Personnel', line_description: '', amount_requested: 0, amount_match: 0, isExisting: false }]);
  };

  const updateBudgetItem = (idx, field, value) => {
    setBudgetItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeBudgetItem = async (idx) => {
    const item = budgetItems[idx];
    if (item.isExisting && item.id) {
      await base44.entities.ApplicationBudget.delete(item.id);
    }
    setBudgetItems(prev => prev.filter((_, i) => i !== idx));
  };

  const budgetTotal = budgetItems.reduce((s, b) => s + (Number(b.amount_requested) || 0), 0);
  const matchTotal = budgetItems.reduce((s, b) => s + (Number(b.amount_match) || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {app?.status === 'RevisionRequested' ? 'Revise Application' : 'New Application'}
        </h1>
        {nofo && <p className="text-muted-foreground text-sm mt-1">Applying for: {nofo.title}</p>}
        {app?.revision_notes && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Revision Requested:</strong> {app.revision_notes}
          </div>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border p-6">
        {/* Step 1: Organization */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Organization Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Organization Name</Label><Input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Type</Label>
                <Select value={orgForm.type} onValueChange={v => setOrgForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['County', 'Municipality', 'Nonprofit', 'Tribe'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>EIN</Label><Input value={orgForm.ein} onChange={e => setOrgForm(f => ({ ...f, ein: e.target.value }))} /></div>
              <div><Label>SAM UEI</Label><Input value={orgForm.sam_uei} onChange={e => setOrgForm(f => ({ ...f, sam_uei: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={orgForm.address} onChange={e => setOrgForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>City</Label><Input value={orgForm.city} onChange={e => setOrgForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={orgForm.state} onChange={e => setOrgForm(f => ({ ...f, state: e.target.value }))} /></div>
              <div><Label>ZIP</Label><Input value={orgForm.zip} onChange={e => setOrgForm(f => ({ ...f, zip: e.target.value }))} /></div>
              <div><Label>County</Label><Input value={orgForm.county} onChange={e => setOrgForm(f => ({ ...f, county: e.target.value }))} /></div>
            </div>
          </div>
        )}

        {/* Step 2: Project Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Project Details</h2>
            <div><Label>Project Title</Label><Input value={form.project_title} onChange={e => setForm(f => ({ ...f, project_title: e.target.value }))} /></div>
            <div><Label>Project Narrative</Label><Textarea value={form.project_narrative} onChange={e => setForm(f => ({ ...f, project_narrative: e.target.value }))} rows={6} /></div>
            <div><Label>Work Plan</Label><Textarea value={form.work_plan} onChange={e => setForm(f => ({ ...f, work_plan: e.target.value }))} rows={4} /></div>
            <div><Label>Risk Assessment</Label><Textarea value={form.risk_assessment} onChange={e => setForm(f => ({ ...f, risk_assessment: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Requested Amount ($)</Label><Input type="number" value={form.requested_amount} onChange={e => setForm(f => ({ ...f, requested_amount: e.target.value }))} /></div>
              <div><Label>Match/Cost-Share ($)</Label><Input type="number" value={form.match_amount} onChange={e => setForm(f => ({ ...f, match_amount: e.target.value }))} /></div>
              <div><Label>Performance Start</Label><Input type="date" value={form.performance_start} onChange={e => setForm(f => ({ ...f, performance_start: e.target.value }))} /></div>
              <div><Label>Performance End</Label><Input type="date" value={form.performance_end} onChange={e => setForm(f => ({ ...f, performance_end: e.target.value }))} /></div>
            </div>
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Budget</h2>
              <Button variant="outline" size="sm" onClick={addBudgetItem}>+ Add Line Item</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Requested ($)</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Match ($)</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">
                        <Select value={item.budget_category} onValueChange={v => updateBudgetItem(idx, 'budget_category', v)}>
                          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{BUDGET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input value={item.line_description} onChange={e => updateBudgetItem(idx, 'line_description', e.target.value)} /></td>
                      <td className="p-2"><Input type="number" className="text-right w-28" value={item.amount_requested} onChange={e => updateBudgetItem(idx, 'amount_requested', e.target.value)} /></td>
                      <td className="p-2"><Input type="number" className="text-right w-28" value={item.amount_match} onChange={e => updateBudgetItem(idx, 'amount_match', e.target.value)} /></td>
                      <td className="p-2"><Button variant="ghost" size="icon" onClick={() => removeBudgetItem(idx)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-2" colSpan={2}>Total</td>
                    <td className="p-2 text-right">{formatCurrency(budgetTotal)}</td>
                    <td className="p-2 text-right">{formatCurrency(matchTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {budgetTotal !== Number(form.requested_amount) && Number(form.requested_amount) > 0 && (
              <p className="text-sm text-amber-600">Budget total ({formatCurrency(budgetTotal)}) does not match requested amount ({formatCurrency(Number(form.requested_amount))})</p>
            )}
          </div>
        )}

        {/* Step 4: Documents */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Documents</h2>
            {nofo?.required_documents?.length > 0 ? (
              <div className="space-y-3">
                {nofo.required_documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.mandatory ? 'Required' : 'Optional'}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                      input.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          await base44.entities.Document.create({
                            name: doc.name, doc_type: 'Application', file_url,
                            uploaded_by: user?.email, organization_id: org?.id,
                            entity_id: app?.id, uploaded_at: new Date().toISOString(),
                          });
                        }
                      };
                      input.click();
                    }}>
                      Upload
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No specific documents required for this NOFO. You can upload supporting documents below.</p>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Review & Submit</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Organization</p><p className="font-medium">{orgForm.name}</p></div>
              <div><p className="text-muted-foreground text-xs">NOFO</p><p className="font-medium">{nofo?.title}</p></div>
              <div><p className="text-muted-foreground text-xs">Project Title</p><p className="font-medium">{form.project_title}</p></div>
              <div><p className="text-muted-foreground text-xs">Requested Amount</p><p className="font-bold text-lg">{formatCurrency(Number(form.requested_amount))}</p></div>
              <div><p className="text-muted-foreground text-xs">Match Commitment</p><p className="font-medium">{formatCurrency(Number(form.match_amount))}</p></div>
              <div><p className="text-muted-foreground text-xs">Budget Line Items</p><p className="font-medium">{budgetItems.length} items totaling {formatCurrency(budgetTotal)}</p></div>
              <div><p className="text-muted-foreground text-xs">Performance Start</p><p className="font-medium">{form.performance_start || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">Performance End</p><p className="font-medium">{form.performance_end || '—'}</p></div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => { saveDraft(); setStep(s => s + 1); }}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submitApplication} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}