import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle, AlertTriangle, FileText, BookOpen, DollarSign, Calendar, Users, Pencil, Plus, X, Save } from 'lucide-react';

// Hardcoded FEMA defaults used as fallback when no custom data is saved
const FEMA_DEFAULTS = {
  SHSP: {
    purpose: 'Supports implementation of State Homeland Security Strategies to address identified planning, organization, equipment, training, and exercise needs to prevent, protect against, mitigate, respond to, and recover from acts of terrorism and other catastrophic events.',
    eligibility_requirements: ['State Administrative Agencies (SAAs)', 'Local governments via subgrant', 'Tribal governments via subgrant'],
    allowable_costs: ['Planning (up to 25% of total award)', 'Organization (personnel costs)', 'Equipment (FEMA-approved equipment categories)', 'Training (FEMA-approved courses)', 'Exercises (HSEEP-compliant)', 'Management & Administration (up to 5%)'],
    compliance_requirements: ['Must align with State Preparedness Report (SPR) and THIRA', 'Biannual Strategy Implementation Report (BSIR) required', 'NIMS compliance mandatory', 'Equipment must be on FEMA Authorized Equipment List (AEL)', 'All training must be FEMA-approved or equivalent', 'Exercises must follow HSEEP', 'EEO/civil rights compliance per 2 CFR Part 200', 'EHP review required', 'Procurement must follow 2 CFR §200.317 - 200.326'],
    reporting_requirements: ['Biannual Performance Reports (July 30 and January 30)', 'Financial Status Reports (quarterly)', 'Final Performance Report within 90 days of period end'],
    performance_period: '36 months (with possible extension)',
    match_requirement: 'No cost-share requirement',
  },
  UASI: {
    purpose: 'Addresses the unique planning, organization, equipment, training, and exercise needs of high-threat, high-density urban areas.',
    eligibility_requirements: ['Designated Urban Areas only', 'UASI-eligible cities per DHS determination', 'Regional partners via subgrant'],
    allowable_costs: ['Planning (up to 25%)', 'Organization and personnel', 'Equipment (AEL-approved)', 'Training', 'Exercises (HSEEP-compliant)', 'M&A (up to 5%)'],
    compliance_requirements: ['Urban Area Working Group (UAWG) governance required', 'THIRA/SPR alignment required', 'NIMS compliance mandatory', 'Regional coordination and mutual aid agreements required', 'Equipment must be on FEMA AEL', 'EHP compliance for all projects', '2 CFR Part 200 compliance'],
    reporting_requirements: ['Biannual Performance Reports', 'Financial Status Reports (quarterly)', 'Investment Justifications (IJs) required'],
    performance_period: '36 months',
    match_requirement: 'No cost-share requirement',
  },
  EMPG: {
    purpose: 'Supports state, local, tribal, and territorial emergency management capabilities by providing resources for personnel, planning, equipment, training, and exercises.',
    eligibility_requirements: ['State Emergency Management Agencies', 'Local Emergency Management Agencies via subgrant'],
    allowable_costs: ['Emergency Management Personnel (salaries, benefits)', 'Planning activities', 'Training and exercises', 'Equipment for emergency management operations', 'M&A (up to 3%)'],
    compliance_requirements: ['50% cost match required (1:1 non-federal match)', 'NIMS compliance', 'Staffing Plan must be submitted', 'Must maintain current Emergency Operations Plan (EOP)', 'COOP required', '2 CFR Part 200 compliance'],
    reporting_requirements: ['Performance Reports (semi-annual)', 'Financial Reports (quarterly)', 'Match documentation required with each financial report'],
    performance_period: '24 months',
    match_requirement: '50% non-federal cost share required',
  },
  HSGP: {
    purpose: 'Umbrella program encompassing SHSP and UASI to support efforts to prevent terrorism and prepare the Nation for threats and hazards.',
    eligibility_requirements: ['State Administrative Agencies', 'UASI-designated urban areas', 'Local governments via subgrant'],
    allowable_costs: ['Planning (up to 25%)', 'Organization', 'Equipment (AEL-approved)', 'Training (FEMA-approved)', 'Exercises (HSEEP)', 'M&A (up to 5%)'],
    compliance_requirements: ['Investment Justifications (IJs) required linking to THIRA gaps', 'NIMS implementation and compliance', 'Subrecipient monitoring per 2 CFR §200.332', 'Equipment inventory tracking per 2 CFR §200.313', 'EHP review for applicable projects', 'Audit requirements per 2 CFR Part 200 Subpart F'],
    reporting_requirements: ['Biannual Performance Reports', 'Quarterly Financial Reports', 'Investment Justification updates'],
    performance_period: '36 months',
    match_requirement: 'No cost-share requirement',
  },
  NSGP: {
    purpose: 'Provides funding support for target hardening and other physical security enhancements to nonprofit organizations at high risk of a terrorist attack.',
    eligibility_requirements: ['501(c)(3) nonprofit organizations', 'Organizations at high risk of terrorist attack', 'Must be located in UASI-designated area or state'],
    allowable_costs: ['Physical security enhancements (target hardening)', 'Security equipment (cameras, lighting, barriers)', 'Security planning', 'Cybersecurity enhancements', 'Training on security awareness'],
    compliance_requirements: ['Must demonstrate threat/risk to justify funding', 'Security Plan must be submitted and approved', 'All equipment on FEMA AEL', 'Cannot use funds for personnel costs', 'No supplanting of existing security expenditures', 'EHP compliance for physical modifications', '2 CFR Part 200 compliance', 'IRS 501(c)(3) determination letter required'],
    reporting_requirements: ['Performance Reports (semi-annual)', 'Financial Reports (quarterly)', 'Final report within 90 days of period end'],
    performance_period: '36 months',
    match_requirement: 'No cost-share requirement',
  },
  EOC: {
    purpose: 'Supports the design and construction of state and local EOCs that provide the structures, processes, and tools needed to coordinate response to disasters and emergencies.',
    eligibility_requirements: ['State governments', 'Local governments', 'Tribal governments'],
    allowable_costs: ['Construction/renovation of EOC facilities', 'EOC equipment and technology', 'Interoperable communications systems', 'Planning for EOC operations', 'Training for EOC staff'],
    compliance_requirements: ['Must meet FEMA EOC design standards', 'EHP review required - submit early', 'Floodplain management compliance (EO 11988)', 'Construction contracts must include Davis-Bacon wage requirements', '2 CFR Part 200 compliance', 'Section 504/ADA accessibility compliance', 'Must maintain facility for minimum 10 years post-completion'],
    reporting_requirements: ['Quarterly Progress Reports (construction milestones)', 'Financial Reports (quarterly)', 'Final closeout within 90 days'],
    performance_period: '48 months (construction grants)',
    match_requirement: '50% non-federal cost share required',
  },
  SLCGP: {
    purpose: 'Addresses cybersecurity risks and threats to information systems owned or operated by state, local, tribal, and territorial governments.',
    eligibility_requirements: ['State governments', 'Local governments via subgrant', 'Tribal governments'],
    allowable_costs: ['Cybersecurity planning and assessments', 'Cybersecurity technology and tools', 'Personnel (up to 50% for eligible positions)', 'Training and exercises', 'Cybersecurity awareness programs', 'M&A (up to 5%)'],
    compliance_requirements: ['State Cybersecurity Plan required and CISA-approved', 'Cybersecurity Planning Committee must be established', 'NIST Cybersecurity Framework alignment required', 'At least 80% of funds must be passed through to local governments', 'Cybersecurity posture assessments required', '2 CFR Part 200 compliance'],
    reporting_requirements: ['Semiannual Performance Reports', 'Quarterly Financial Reports', 'Cybersecurity Plan annual updates'],
    performance_period: '48 months',
    match_requirement: 'No cost-share (years 1 - 2); 10% in year 3; 20% in year 4+',
  },
};

const DEFAULT_FALLBACK = {
  purpose: 'Contact your FEMA regional office for program-specific requirements.',
  eligibility_requirements: ['Contact FEMA for eligibility details'],
  allowable_costs: ['Review FEMA Notice of Funding Opportunity (NOFO) for allowable costs'],
  compliance_requirements: ['2 CFR Part 200 Uniform Administrative Requirements', 'NIMS compliance', 'EHP review as applicable'],
  reporting_requirements: ['As specified in the grant award'],
  performance_period: 'Per award',
  match_requirement: 'Per NOFO',
};

function EditableList({ items, onChange }) {
  const update = (i, val) => { const arr = [...items]; arr[i] = val; onChange(arr); };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input value={item} onChange={e => update(i, e.target.value)} className="text-sm flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500" onClick={() => remove(i)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full mt-1">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
      </Button>
    </div>
  );
}

function RequirementList({ items, icon: Icon, color }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function GrantProgramDetail({ program, onClose, isAdmin = false, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null);

  if (!program) return null;

  const defaults = FEMA_DEFAULTS[program.code] || DEFAULT_FALLBACK;

  // Merge saved data over defaults
  const req = {
    purpose: program.purpose || defaults.purpose,
    eligibility_requirements: program.eligibility_requirements?.length ? program.eligibility_requirements : defaults.eligibility_requirements,
    allowable_costs: program.allowable_costs?.length ? program.allowable_costs : defaults.allowable_costs,
    compliance_requirements: program.compliance_requirements?.length ? program.compliance_requirements : defaults.compliance_requirements,
    reporting_requirements: program.reporting_requirements?.length ? program.reporting_requirements : defaults.reporting_requirements,
    performance_period: program.performance_period || defaults.performance_period,
    match_requirement: program.match_requirement || defaults.match_requirement,
  };

  const startEditing = () => {
    setDraft({ ...req });
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setDraft(null); };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.GrantProgram.update(program.id, {
      purpose: draft.purpose,
      eligibility_requirements: draft.eligibility_requirements,
      allowable_costs: draft.allowable_costs,
      compliance_requirements: draft.compliance_requirements,
      reporting_requirements: draft.reporting_requirements,
      performance_period: draft.performance_period,
      match_requirement: draft.match_requirement,
    });
    setSaving(false);
    setEditing(false);
    setDraft(null);
    if (onSaved) onSaved();
  };

  const d = editing ? draft : req;

  return (
    <Dialog open={!!program} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold">{program.code}</span>
              <DialogTitle className="text-lg">{program.name}</DialogTitle>
            </div>
            {isAdmin && !editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Requirements
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
            {program.federal_agency && <span><strong>Agency:</strong> {program.federal_agency}</span>}
            {program.cfda_number && <span><strong>CFDA:</strong> {program.cfda_number}</span>}
            {editing ? (
              <>
                <div className="flex items-center gap-1.5">
                  <strong>Period:</strong>
                  <Input value={d.performance_period} onChange={e => setDraft(v => ({ ...v, performance_period: e.target.value }))} className="h-6 text-xs w-48 py-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <strong>Match:</strong>
                  <Input value={d.match_requirement} onChange={e => setDraft(v => ({ ...v, match_requirement: e.target.value }))} className="h-6 text-xs w-48 py-0" />
                </div>
              </>
            ) : (
              <>
                <span><strong>Period:</strong> {d.performance_period}</span>
                <span><strong>Match:</strong> {d.match_requirement}</span>
              </>
            )}
          </div>
        </DialogHeader>

        {/* Program Purpose */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
          <p className="font-semibold mb-1 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Program Purpose</p>
          {editing ? (
            <Textarea value={d.purpose} onChange={e => setDraft(v => ({ ...v, purpose: e.target.value }))} className="text-sm bg-white" rows={3} />
          ) : (
            <p>{d.purpose}</p>
          )}
        </div>

        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance">Compliance Requirements</TabsTrigger>
            <TabsTrigger value="costs">Allowable Costs</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
          </TabsList>

          <TabsContent value="compliance" className="space-y-3 pt-2">
            {!editing && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Requirements are based on FEMA guidance and 2 CFR Part 200. Always refer to the current NOFO and your FEMA Regional Administrator for the most up-to-date requirements.</span>
              </div>
            )}
            {editing
              ? <EditableList items={d.compliance_requirements} onChange={v => setDraft(x => ({ ...x, compliance_requirements: v }))} />
              : <RequirementList items={d.compliance_requirements} icon={CheckCircle} color="text-green-600" />}
          </TabsContent>

          <TabsContent value="costs" className="pt-2">
            {editing
              ? <EditableList items={d.allowable_costs} onChange={v => setDraft(x => ({ ...x, allowable_costs: v }))} />
              : <RequirementList items={d.allowable_costs} icon={DollarSign} color="text-blue-600" />}
          </TabsContent>

          <TabsContent value="eligibility" className="pt-2">
            {editing
              ? <EditableList items={d.eligibility_requirements} onChange={v => setDraft(x => ({ ...x, eligibility_requirements: v }))} />
              : <RequirementList items={d.eligibility_requirements} icon={Users} color="text-purple-600" />}
          </TabsContent>

          <TabsContent value="reporting" className="pt-2">
            {editing
              ? <EditableList items={d.reporting_requirements} onChange={v => setDraft(x => ({ ...x, reporting_requirements: v }))} />
              : (
                <>
                  <RequirementList items={d.reporting_requirements} icon={FileText} color="text-slate-600" />
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Performance Period: <strong>{d.performance_period}</strong>. Late or incomplete reports may result in sanctions, award suspension, or termination per 2 CFR §200.338.</span>
                  </div>
                </>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}