import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Info } from 'lucide-react';

const FieldGroup = ({ title, description, children }) => (
  <div className="space-y-3">
    <div>
      <h3 className="font-semibold text-sm">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const Field = ({ label, required, children }) => (
  <div>
    <Label className="text-sm">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
  </div>
);

export default function ProgramSpecificFields({ programCode, form, onChange }) {
  const set = (key, val) => onChange({ ...form, [key]: val });

  if (!programCode) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/50 text-muted-foreground text-sm">
        <Info className="h-4 w-4 flex-shrink-0" />
        No program selected. Program-specific fields will appear once a program is associated with this application.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* SHSP Fields */}
      {programCode === 'SHSP' && (
        <>
          <FieldGroup title="Investment Justification (IJ)" description="Required for SHSP — describes how the project addresses a THIRA/SPR-identified gap.">
            <Field label="IJ Title" required><Input value={form.ij_title || ''} onChange={e => set('ij_title', e.target.value)} /></Field>
            <Field label="IJ Narrative" required><Textarea rows={4} value={form.ij_description || ''} onChange={e => set('ij_description', e.target.value)} placeholder="Describe the investment justification..." /></Field>
            <Field label="Primary Core Capability Addressed" required>
              <Input value={form.ij_core_capability || ''} onChange={e => set('ij_core_capability', e.target.value)} placeholder="e.g. Cybersecurity, Planning, etc." />
            </Field>
            <Field label="Funding Priority Alignment"><Textarea rows={2} value={form.ij_funding_priority || ''} onChange={e => set('ij_funding_priority', e.target.value)} placeholder="Describe alignment with state funding priorities..." /></Field>
          </FieldGroup>

          <FieldGroup title="THIRA/SPR Alignment" description="Explain how this project addresses threats, hazards, risks, and gaps identified in your THIRA and SPR.">
            <Field label="THIRA/SPR Alignment Narrative" required><Textarea rows={4} value={form.thira_spr_alignment || ''} onChange={e => set('thira_spr_alignment', e.target.value)} placeholder="Describe alignment with THIRA/SPR findings..." /></Field>
          </FieldGroup>

          <FieldGroup title="NPA Minimum Allocation" description="SHSP requires a minimum allocation to Local Emergency Planning Committees (LEPCs) or equivalent.">
            <div className="flex items-center gap-3">
              <Switch checked={!!form.npa_minimum_met} onCheckedChange={v => set('npa_minimum_met', v)} />
              <Label>NPA Minimum Allocation Requirement Met</Label>
            </div>
            <Field label="NPA Allocation Amount ($)">
              <Input type="number" value={form.npa_allocation_amount || ''} onChange={e => set('npa_allocation_amount', e.target.value)} />
            </Field>
          </FieldGroup>
        </>
      )}

      {/* EMPG Fields */}
      {programCode === 'EMPG' && (
        <>
          <FieldGroup title="Work Plan" description="EMPG requires a detailed work plan with measurable objectives.">
            <Field label="Key Work Plan Objectives" required><Textarea rows={4} value={form.empg_work_plan_objectives || ''} onChange={e => set('empg_work_plan_objectives', e.target.value)} placeholder="List key objectives, activities, and measurable deliverables..." /></Field>
          </FieldGroup>

          <FieldGroup title="Cost-Share Match" description="EMPG requires a 50% non-federal cost-share match that must be documented and traceable.">
            <Field label="Match Source" required><Input value={form.empg_match_source || ''} onChange={e => set('empg_match_source', e.target.value)} placeholder="e.g. State General Fund, County Operating Budget..." /></Field>
            <Field label="Match Description" required><Textarea rows={3} value={form.empg_match_description || ''} onChange={e => set('empg_match_description', e.target.value)} placeholder="Describe how match will be documented and tracked..." /></Field>
          </FieldGroup>
        </>
      )}

      {/* SLCGP Fields */}
      {programCode === 'SLCGP' && (
        <>
          <FieldGroup title="Cybersecurity Plan" description="Required for SLCGP — must address the State and Local Cybersecurity Grant Program requirements.">
            <Field label="Cybersecurity Plan Narrative" required><Textarea rows={5} value={form.slcgp_cybersecurity_plan || ''} onChange={e => set('slcgp_cybersecurity_plan', e.target.value)} placeholder="Describe your cybersecurity plan, goals, and alignment with CISA guidance..." /></Field>
            <Field label="Project Worksheet Details" required><Textarea rows={3} value={form.slcgp_project_worksheet || ''} onChange={e => set('slcgp_project_worksheet', e.target.value)} placeholder="Summarize the project worksheet content..." /></Field>
          </FieldGroup>

          <FieldGroup title="Rural Allocation" description="SLCGP requires a portion of funding allocated to rural areas.">
            <Field label="Rural Allocation Amount ($)"><Input type="number" value={form.slcgp_rural_allocation || ''} onChange={e => set('slcgp_rural_allocation', e.target.value)} /></Field>
            <Field label="Rural Allocation Approach"><Textarea rows={2} value={form.slcgp_rural_allocation_notes || ''} onChange={e => set('slcgp_rural_allocation_notes', e.target.value)} placeholder="Describe how rural allocation will be distributed..." /></Field>
          </FieldGroup>
        </>
      )}

      {/* NSGP Fields */}
      {programCode === 'NSGP' && (
        <>
          <FieldGroup title="Investment Justification (IJ)" description="NSGP requires a completed FEMA IJ PDF to be uploaded in the Documents step. Provide summary details here.">
            <Field label="IJ Title" required><Input value={form.ij_title || ''} onChange={e => set('ij_title', e.target.value)} /></Field>
            <Field label="IJ Narrative Summary" required><Textarea rows={4} value={form.ij_description || ''} onChange={e => set('ij_description', e.target.value)} placeholder="Summarize the IJ — the full FEMA IJ PDF must also be uploaded..." /></Field>
          </FieldGroup>

          <FieldGroup title="Vulnerability Assessment" description="All NSGP applicants must have a completed vulnerability assessment.">
            <Field label="Vulnerability Assessment Summary" required><Textarea rows={4} value={form.nsgp_vulnerability_assessment || ''} onChange={e => set('nsgp_vulnerability_assessment', e.target.value)} placeholder="Summarize the vulnerability assessment findings..." /></Field>
          </FieldGroup>

          <FieldGroup title="Organization Mission">
            <Field label="Mission Statement" required><Textarea rows={3} value={form.nsgp_mission_statement || ''} onChange={e => set('nsgp_mission_statement', e.target.value)} placeholder="Provide the organization's mission statement..." /></Field>
            <Field label="Target Hardening Description"><Textarea rows={3} value={form.nsgp_target_hardening_description || ''} onChange={e => set('nsgp_target_hardening_description', e.target.value)} placeholder="Describe target hardening activities planned..." /></Field>
          </FieldGroup>
        </>
      )}

      {/* EOC Fields */}
      {programCode === 'EOC' && (
        <>
          <FieldGroup title="Construction Details" description="EOC projects involve construction or substantial renovation — additional compliance documentation is required.">
            <Field label="Construction Timeline" required><Textarea rows={4} value={form.eoc_construction_timeline || ''} onChange={e => set('eoc_construction_timeline', e.target.value)} placeholder="Describe project phases, key milestones, and estimated completion..." /></Field>
            <Field label="Procurement Plan" required><Textarea rows={3} value={form.eoc_procurement_plan || ''} onChange={e => set('eoc_procurement_plan', e.target.value)} placeholder="Describe procurement method and compliance with 2 CFR 200.317-327..." /></Field>
          </FieldGroup>

          <FieldGroup title="Site Control" description="Site control must be established before EHP review can proceed.">
            <Field label="Site Control Status" required>
              <Select value={form.eoc_site_control_status || ''} onValueChange={v => set('eoc_site_control_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owned">Owned</SelectItem>
                  <SelectItem value="Leased">Leased</SelectItem>
                  <SelectItem value="In-Progress">In-Progress</SelectItem>
                  <SelectItem value="Not-Established">Not Yet Established</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Site Control Notes"><Textarea rows={2} value={form.eoc_site_control_notes || ''} onChange={e => set('eoc_site_control_notes', e.target.value)} placeholder="Notes on site control documentation..." /></Field>
          </FieldGroup>
        </>
      )}

      {/* Procurement Section (all programs) */}
      <FieldGroup title="Procurement Method" description="All federally-funded procurement must follow 2 CFR 200.317–327.">
        <Field label="Primary Procurement Method">
          <Select value={form.procurement_method || ''} onValueChange={v => set('procurement_method', v)}>
            <SelectTrigger><SelectValue placeholder="Select method..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CompetitiveBid">Competitive Bid / Sealed Bid</SelectItem>
              <SelectItem value="SoleSource">Sole Source</SelectItem>
              <SelectItem value="SmallPurchase">Small Purchase (&lt; $250,000)</SelectItem>
              <SelectItem value="MicroPurchase">Micro-Purchase (&lt; $10,000)</SelectItem>
              <SelectItem value="NotApplicable">Not Applicable</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {(form.procurement_method === 'SoleSource') && (
          <Field label="Sole Source Justification" required>
            <Textarea rows={3} value={form.procurement_justification || ''} onChange={e => set('procurement_justification', e.target.value)} placeholder="Provide detailed justification for sole-source procurement..." />
          </Field>
        )}
        <Field label="Estimated Procurement Amount ($)">
          <Input type="number" value={form.procurement_amount || ''} onChange={e => set('procurement_amount', e.target.value)} />
        </Field>
      </FieldGroup>
    </div>
  );
}