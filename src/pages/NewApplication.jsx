import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, logAudit, createNotification } from '../lib/helpers';
import BudgetBuilder from '../components/BudgetBuilder';
import ProgramSpecificFields from '../components/ProgramSpecificFields';
import EHPScreening from '../components/EHPScreening';
import DocumentsStep from '../components/ApplicationDocumentsStep';

const STEPS = ['Organization', 'Project Details', 'Program Details', 'EHP Screening', 'Budget', 'Documents', 'Review & Submit'];

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
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const [form, setForm] = useState({
    project_title: '', project_narrative: '', work_plan: '', risk_assessment: '',
    requested_amount: 0, match_amount: 0, performance_start: '', performance_end: '',
    // Program-specific fields
    ij_title: '', ij_description: '', ij_core_capability: '', ij_funding_priority: '',
    thira_spr_alignment: '', npa_minimum_met: false, npa_allocation_amount: 0,
    empg_match_source: '', empg_match_description: '', empg_work_plan_objectives: '',
    slcgp_cybersecurity_plan: '', slcgp_project_worksheet: '', slcgp_rural_allocation: 0, slcgp_rural_allocation_notes: '',
    nsgp_vulnerability_assessment: '', nsgp_mission_statement: '', nsgp_target_hardening_description: '',
    eoc_construction_timeline: '', eoc_site_control_status: '', eoc_site_control_notes: '', eoc_procurement_plan: '',
    procurement_method: '', procurement_justification: '', procurement_amount: 0,
    // EHP fields
    ehp_required: false, ehp_screening_answers: {}, ehp_status: 'NotRequired', ehp_notes: '',
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
        const a0 = apps[0];
        setForm({
          project_title: a0.project_title || '',
          project_narrative: a0.project_narrative || '',
          work_plan: a0.work_plan || '',
          risk_assessment: a0.risk_assessment || '',
          requested_amount: a0.requested_amount || 0,
          match_amount: a0.match_amount || 0,
          performance_start: a0.performance_start || '',
          performance_end: a0.performance_end || '',
          ij_title: a0.ij_title || '', ij_description: a0.ij_description || '',
          ij_core_capability: a0.ij_core_capability || '', ij_funding_priority: a0.ij_funding_priority || '',
          thira_spr_alignment: a0.thira_spr_alignment || '', npa_minimum_met: a0.npa_minimum_met || false,
          npa_allocation_amount: a0.npa_allocation_amount || 0,
          empg_match_source: a0.empg_match_source || '', empg_match_description: a0.empg_match_description || '',
          empg_work_plan_objectives: a0.empg_work_plan_objectives || '',
          slcgp_cybersecurity_plan: a0.slcgp_cybersecurity_plan || '',
          slcgp_project_worksheet: a0.slcgp_project_worksheet || '',
          slcgp_rural_allocation: a0.slcgp_rural_allocation || 0,
          slcgp_rural_allocation_notes: a0.slcgp_rural_allocation_notes || '',
          nsgp_vulnerability_assessment: a0.nsgp_vulnerability_assessment || '',
          nsgp_mission_statement: a0.nsgp_mission_statement || '',
          nsgp_target_hardening_description: a0.nsgp_target_hardening_description || '',
          eoc_construction_timeline: a0.eoc_construction_timeline || '',
          eoc_site_control_status: a0.eoc_site_control_status || '',
          eoc_site_control_notes: a0.eoc_site_control_notes || '',
          eoc_procurement_plan: a0.eoc_procurement_plan || '',
          procurement_method: a0.procurement_method || '',
          procurement_justification: a0.procurement_justification || '',
          procurement_amount: a0.procurement_amount || 0,
          ehp_required: a0.ehp_required || false,
          ehp_screening_answers: a0.ehp_screening_answers || {},
          ehp_status: a0.ehp_status || 'NotRequired',
          ehp_notes: a0.ehp_notes || '',
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
      grant_number: nofo?.grant_number || app?.grant_number || '',
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
    setConfirmSubmit(false);
    setSubmitError('');
    setSaving(true);
    try {
      // Save draft first (without resetting saving state)
      const data = {
        ...form,
        nofo_id: nofo?.id || app?.nofo_id,
        nofo_title: nofo?.title || app?.nofo_title,
        organization_id: org?.id || user?.organization_id,
        organization_name: orgForm.name || org?.name,
        submitted_by: user?.email,
        program_code: nofo?.program_code || app?.program_code,
        program_name: nofo?.program_name || app?.program_name,
        grant_number: nofo?.grant_number || app?.grant_number || '',
        status: 'Draft',
        requested_amount: Number(form.requested_amount),
        match_amount: Number(form.match_amount),
        version: (app?.version || 0) + 1,
      };
      let savedApp = app;
      if (app) {
        await base44.entities.Application.update(app.id, data);
        savedApp = { ...app, ...data };
      } else {
        savedApp = await base44.entities.Application.create(data);
        setApp(savedApp);
      }

      // Generate application number
      const allApps = await base44.entities.Application.list('-created_date', 1000);
      const appNum = `APP-${new Date().getFullYear()}-${String(allApps.length + 1).padStart(5, '0')}`;

      // Submit
      await base44.entities.Application.update(savedApp.id, {
        status: 'Submitted',
        application_number: appNum,
        submitted_at: new Date().toISOString(),
      });

      // Notify state reviewers
      const allUsers = await base44.entities.User.list().catch(() => []);
      const reviewers = (allUsers || []).filter(u => u.role === 'admin' || u.role === 'reviewer');
      for (const r of reviewers) {
        await createNotification(base44, r.email, 'New Application Submitted',
          `${orgForm.name} submitted application ${appNum} for ${nofo?.title || 'a grant'}.`,
          'app_submitted', 'Application', savedApp.id, '/applications').catch(() => {});
      }

      await logAudit(base44, user, 'Submitted', 'Application', savedApp.id, `Submitted application ${appNum}`).catch(() => {});
      setSubmitSuccess(true);
      setTimeout(() => navigate('/my-applications'), 2000);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('Submission failed: ' + (err?.message || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const budgetTotal = budgetItems.reduce((s, b) => s + (Number(b.amount_requested) || 0), 0);
  const matchTotal = budgetItems.reduce((s, b) => s + (Number(b.amount_match) || 0), 0);

  const handleBudgetChange = async (newItems) => {
    // Handle deletions of existing items
    const removedItems = budgetItems.filter(old => old.isExisting && old.id && !newItems.find(n => n.id === old.id));
    for (const item of removedItems) {
      await base44.entities.ApplicationBudget.delete(item.id);
    }
    setBudgetItems(newItems);
    const total = newItems.reduce((s, b) => s + (Number(b.amount_requested) || 0), 0);
    const match = newItems.reduce((s, b) => s + (Number(b.amount_match) || 0), 0);
    setForm(f => ({ ...f, requested_amount: total, match_amount: match }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  // Block if user has no organization assigned (and this is a new application, not editing existing)
  if (!appId && !org && user?.role === 'user') return (
    <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
        <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h2 className="text-xl font-semibold">Organization Required</h2>
      <p className="text-muted-foreground">Please contact your administrator to assign your organization before creating an application.</p>
      <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">← Go Back</button>
    </div>
  );

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
              <div><Label>Performance Start</Label><Input type="date" value={form.performance_start ? form.performance_start.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, performance_start: e.target.value }))} /></div>
              <div><Label>Performance End</Label><Input type="date" value={form.performance_end ? form.performance_end.substring(0, 10) : '-'} onChange={e => setForm(f => ({ ...f, performance_end: e.target.value }))} /></div>
            </div>
          </div>
        )}

        {/* Step 3: Program Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Program-Specific Details</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                These fields are required for {nofo?.program_code || app?.program_code || 'your selected program'} compliance.
              </p>
            </div>
            <ProgramSpecificFields
              programCode={nofo?.program_code || app?.program_code}
              form={form}
              onChange={setForm}
            />
          </div>
        )}

        {/* Step 4: EHP Screening */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Environmental & Historic Preservation (EHP)</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                FEMA requires EHP review before construction or installation activities. Complete this screening to determine if EHP documentation is needed.
              </p>
            </div>
            <EHPScreening form={form} onChange={setForm} />
          </div>
        )}

        {/* Step 5: Budget */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Budget Builder</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Add line items for each category of spending. The total will automatically sync to your requested amount.</p>
            </div>
            <BudgetBuilder
              items={budgetItems}
              nofo={nofo}
              onChange={handleBudgetChange}
            />
          </div>
        )}

        {/* Step 6: Documents */}
        {step === 5 && (
          <DocumentsStep
            nofo={nofo}
            app={app}
            user={user}
            org={org}
            onSaveDraft={saveDraft}
          />
        )}

        {/* Step 7: Review */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-lg">Review & Submit</h2>
              <p className="text-sm text-muted-foreground mt-1">Please review all information carefully before submitting. Once submitted, you cannot edit the application.</p>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-medium">
                ✓ Application submitted successfully! Redirecting…
              </div>
            )}

            {/* Organization */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Organization</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{orgForm.name || org?.name || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{orgForm.type || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">EIN</p><p className="font-mono">{orgForm.ein || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">SAM UEI</p><p className="font-mono">{orgForm.sam_uei || ' - '}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Address</p><p>{[orgForm.address, orgForm.city, orgForm.state, orgForm.zip].filter(Boolean).join(', ') || ' - '}</p></div>
              </div>
            </div>

            {/* NOFO & Project */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Project Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">NOFO</p><p className="font-medium">{nofo?.title || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">Program</p><p className="font-medium">{nofo?.program_code || app?.program_code || ' - '}</p></div>
                {(nofo?.grant_number || app?.grant_number) && (
                  <div><p className="text-xs text-muted-foreground">Grant Number</p><p className="font-mono">{nofo?.grant_number || app?.grant_number}</p></div>
                )}
                <div><p className="text-xs text-muted-foreground">Project Title</p><p className="font-medium">{form.project_title || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">Performance Start</p><p>{form.performance_start || ' - '}</p></div>
                <div><p className="text-xs text-muted-foreground">Performance End</p><p>{form.performance_end || ' - '}</p></div>
                {form.project_narrative && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Project Narrative</p><p className="text-xs line-clamp-3">{form.project_narrative}</p></div>
                )}
              </div>
            </div>

            {/* Budget */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Budget Summary</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Requested Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(Number(form.requested_amount))}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Match Commitment</p>
                  <p className="font-bold text-lg">{formatCurrency(Number(form.match_amount))}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Budget Line Items</p>
                  <p className="font-bold text-lg">{budgetItems.length} items</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(budgetTotal)} total</p>
                </div>
              </div>
              {budgetItems.length > 0 && (
                <table className="w-full text-xs mt-2">
                  <thead><tr className="border-b"><th className="text-left p-1 text-muted-foreground">Category</th><th className="text-left p-1 text-muted-foreground">Description</th><th className="text-right p-1 text-muted-foreground">Requested</th><th className="text-right p-1 text-muted-foreground">Match</th></tr></thead>
                  <tbody>
                    {budgetItems.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-1">{item.budget_category}</td>
                        <td className="p-1 text-muted-foreground">{item.line_description}</td>
                        <td className="p-1 text-right">{formatCurrency(Number(item.amount_requested))}</td>
                        <td className="p-1 text-right">{formatCurrency(Number(item.amount_match))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Confirmation checkbox */}
            {!submitSuccess && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={confirmSubmit} onChange={e => setConfirmSubmit(e.target.checked)} className="mt-1 rounded" />
                  <span className="text-sm">I confirm that all information is accurate and complete. I understand that submitted applications cannot be edited without administrator approval.</span>
                </label>
              </div>
            )}
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
            <Button
              onClick={submitApplication}
              disabled={saving || !confirmSubmit || submitSuccess}
              className={confirmSubmit ? '' : 'opacity-50'}
            >
              {saving ? 'Submitting...' : submitSuccess ? 'Submitted!' : 'Submit Application'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}