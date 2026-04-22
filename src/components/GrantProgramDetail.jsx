import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertTriangle, FileText, BookOpen, DollarSign, Calendar, Users } from 'lucide-react';

// FEMA-based compliance requirements per program code
const FEMA_REQUIREMENTS = {
  SHSP: {
    full_name: 'State Homeland Security Program',
    cfda: '97.067',
    agency: 'FEMA / DHS',
    purpose: 'Supports implementation of State Homeland Security Strategies to address identified planning, organization, equipment, training, and exercise needs to prevent, protect against, mitigate, respond to, and recover from acts of terrorism and other catastrophic events.',
    eligibility: ['State Administrative Agencies (SAAs)', 'Local governments via subgrant', 'Tribal governments via subgrant'],
    allowable_costs: [
      'Planning (up to 25% of total award)',
      'Organization (personnel costs)',
      'Equipment (FEMA-approved equipment categories)',
      'Training (FEMA-approved courses)',
      'Exercises (HSEEP-compliant)',
      'Management & Administration (up to 5%)',
    ],
    compliance_requirements: [
      'Must align with State Preparedness Report (SPR) and Threat and Hazard Identification and Risk Assessment (THIRA)',
      'Biannual Strategy Implementation Report (BSIR) required',
      'National Incident Management System (NIMS) compliance mandatory',
      'National Preparedness Goal core capabilities alignment',
      'Equipment must be on FEMA Authorized Equipment List (AEL)',
      'All training must be FEMA-approved or equivalent',
      'Exercises must follow Homeland Security Exercise and Evaluation Program (HSEEP)',
      'EEO/civil rights compliance per 2 CFR Part 200',
      'Environmental and Historic Preservation (EHP) review required',
      'Procurement must follow 2 CFR §200.317–200.326',
    ],
    reporting: [
      'Biannual Performance Reports (July 30 and January 30)',
      'Financial Status Reports (quarterly)',
      'Final Performance Report within 90 days of period end',
    ],
    period: '36 months (with possible extension)',
    match: 'No cost-share requirement',
  },
  UASI: {
    full_name: 'Urban Area Security Initiative',
    cfda: '97.067',
    agency: 'FEMA / DHS',
    purpose: 'Addresses the unique planning, organization, equipment, training, and exercise needs of high-threat, high-density urban areas.',
    eligibility: ['Designated Urban Areas only', 'UASI-eligible cities per DHS determination', 'Regional partners via subgrant'],
    allowable_costs: [
      'Planning (up to 25%)',
      'Organization and personnel',
      'Equipment (AEL-approved)',
      'Training',
      'Exercises (HSEEP-compliant)',
      'M&A (up to 5%)',
    ],
    compliance_requirements: [
      'Urban Area Working Group (UAWG) governance required',
      'Urban Area Homeland Security Strategy must be current',
      'THIRA/SPR alignment required',
      'Investments must address DHS-identified threats to urban areas',
      'NIMS compliance mandatory',
      'Regional coordination and mutual aid agreements required',
      'Equipment must be on FEMA AEL',
      'EHP compliance for all projects',
      '2 CFR Part 200 Uniform Guidance compliance',
      'Subrecipient monitoring plan required',
    ],
    reporting: [
      'Biannual Performance Reports',
      'Financial Status Reports (quarterly)',
      'Investment Justifications (IJs) required for funding decisions',
    ],
    period: '36 months',
    match: 'No cost-share requirement',
  },
  EMPG: {
    full_name: 'Emergency Management Performance Grant',
    cfda: '97.042',
    agency: 'FEMA / DHS',
    purpose: 'Supports state, local, tribal, and territorial emergency management capabilities by providing resources for personnel, planning, equipment, training, and exercises.',
    eligibility: ['State Emergency Management Agencies', 'Local Emergency Management Agencies via subgrant'],
    allowable_costs: [
      'Emergency Management Personnel (salaries, benefits)',
      'Planning activities',
      'Training and exercises',
      'Equipment for emergency management operations',
      'M&A (up to 3%)',
    ],
    compliance_requirements: [
      '50% cost match required (1:1 non-federal match)',
      'Emergency Management Accreditation Program (EMAP) standards encouraged',
      'National Incident Management System (NIMS) compliance',
      'Staffing Plan must be submitted with application',
      'Must maintain current Emergency Operations Plan (EOP)',
      'Continuity of Operations Plan (COOP) required',
      'EHP compliance for capital projects',
      '2 CFR Part 200 compliance',
      'Procurement standards per 2 CFR §200.317–200.326',
    ],
    reporting: [
      'Performance Reports (semi-annual)',
      'Financial Reports (quarterly)',
      'Match documentation required with each financial report',
    ],
    period: '24 months',
    match: '50% non-federal cost share required',
  },
  HSGP: {
    full_name: 'Homeland Security Grant Program',
    cfda: '97.067',
    agency: 'FEMA / DHS',
    purpose: 'Umbrella program encompassing SHSP and UASI to support efforts to prevent terrorism and other catastrophic events and to prepare the Nation for threats and hazards.',
    eligibility: ['State Administrative Agencies', 'UASI-designated urban areas', 'Local governments via subgrant'],
    allowable_costs: [
      'Planning (up to 25%)',
      'Organization',
      'Equipment (AEL-approved)',
      'Training (FEMA-approved)',
      'Exercises (HSEEP)',
      'M&A (up to 5%)',
    ],
    compliance_requirements: [
      'Investment Justifications (IJs) required linking to THIRA gaps',
      'National Priorities alignment mandatory',
      'NIMS implementation and compliance',
      'Subrecipient monitoring per 2 CFR §200.332',
      'Equipment inventory tracking and disposition per 2 CFR §200.313',
      'EHP review for applicable projects',
      'SAA must maintain approved BSIR',
      'Audit requirements per 2 CFR Part 200 Subpart F',
    ],
    reporting: [
      'Biannual Performance Reports',
      'Quarterly Financial Reports',
      'Investment Justification updates',
    ],
    period: '36 months',
    match: 'No cost-share requirement',
  },
  NSGP: {
    full_name: 'Nonprofit Security Grant Program',
    cfda: '97.008',
    agency: 'FEMA / DHS',
    purpose: 'Provides funding support for target hardening and other physical security enhancements to nonprofit organizations that are at high risk of a terrorist attack.',
    eligibility: ['501(c)(3) nonprofit organizations', 'Organizations at high risk of terrorist attack', 'Must be located in UASI-designated area or state'],
    allowable_costs: [
      'Physical security enhancements (target hardening)',
      'Security equipment (cameras, lighting, barriers)',
      'Security planning',
      'Cybersecurity enhancements',
      'Training on security awareness',
    ],
    compliance_requirements: [
      'Must demonstrate threat/risk to justify funding',
      'Security Plan must be submitted and approved',
      'All equipment on FEMA AEL',
      'Cannot use funds for personnel costs',
      'No supplanting of existing security expenditures',
      'EHP compliance for physical modifications',
      '2 CFR Part 200 compliance for subrecipients',
      'IRS 501(c)(3) determination letter required',
    ],
    reporting: [
      'Performance Reports (semi-annual)',
      'Financial Reports (quarterly)',
      'Final report within 90 days of period end',
    ],
    period: '36 months',
    match: 'No cost-share requirement',
  },
  EOC: {
    full_name: 'Emergency Operations Center Grant',
    cfda: '97.052',
    agency: 'FEMA / DHS',
    purpose: 'Supports the design and construction of state and local EOCs that provide the structures, processes, and tools needed to coordinate response to disasters and emergencies.',
    eligibility: ['State governments', 'Local governments', 'Tribal governments'],
    allowable_costs: [
      'Construction/renovation of EOC facilities',
      'EOC equipment and technology',
      'Interoperable communications systems',
      'Planning for EOC operations',
      'Training for EOC staff',
    ],
    compliance_requirements: [
      'Must meet FEMA EOC design standards',
      'Environmental and Historic Preservation (EHP) review required — submit early',
      'Floodplain management compliance (EO 11988)',
      'Architectural/engineering plans must be approved',
      'Real property acquisition must follow Uniform Relocation Act',
      'Construction contracts must include Davis-Bacon wage requirements',
      '2 CFR Part 200 compliance',
      'Section 504/ADA accessibility compliance',
      'Must maintain facility for minimum 10 years post-completion',
    ],
    reporting: [
      'Quarterly Progress Reports (construction milestones)',
      'Financial Reports (quarterly)',
      'Final closeout within 90 days',
    ],
    period: '48 months (construction grants)',
    match: '50% non-federal cost share required',
  },
  SLCGP: {
    full_name: 'State and Local Cybersecurity Grant Program',
    cfda: '97.137',
    agency: 'CISA / DHS',
    purpose: 'Addresses cybersecurity risks and threats to information systems owned or operated by state, local, tribal, and territorial governments.',
    eligibility: ['State governments', 'Local governments via subgrant', 'Tribal governments'],
    allowable_costs: [
      'Cybersecurity planning and assessments',
      'Cybersecurity technology and tools',
      'Personnel (up to 50% for eligible positions)',
      'Training and exercises',
      'Cybersecurity awareness programs',
      'M&A (up to 5%)',
    ],
    compliance_requirements: [
      'State Cybersecurity Plan required and CISA-approved',
      'Cybersecurity Planning Committee must be established',
      'NIST Cybersecurity Framework alignment required',
      'Must include local government and rural coordination',
      'At least 80% of funds must be passed through to local governments',
      'Cybersecurity posture assessments required',
      'EHP compliance does not typically apply but confirm with CISA',
      '2 CFR Part 200 compliance',
      'Data privacy requirements per applicable federal law',
    ],
    reporting: [
      'Semiannual Performance Reports',
      'Quarterly Financial Reports',
      'Cybersecurity Plan annual updates',
    ],
    period: '48 months',
    match: 'No cost-share (years 1–2); 10% in year 3; 20% in year 4+',
  },
};

const DEFAULT_REQUIREMENTS = {
  full_name: '',
  purpose: 'Contact your FEMA regional office for program-specific requirements.',
  eligibility: ['Contact FEMA for eligibility details'],
  allowable_costs: ['Review FEMA Notice of Funding Opportunity (NOFO) for allowable costs'],
  compliance_requirements: [
    '2 CFR Part 200 Uniform Administrative Requirements',
    'NIMS compliance',
    'EHP review as applicable',
  ],
  reporting: ['As specified in the grant award'],
  period: 'Per award',
  match: 'Per NOFO',
};

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

export default function GrantProgramDetail({ program, onClose }) {
  if (!program) return null;
  const req = FEMA_REQUIREMENTS[program.code] || { ...DEFAULT_REQUIREMENTS, full_name: program.name };

  return (
    <Dialog open={!!program} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold">{program.code}</span>
            <DialogTitle className="text-lg">{req.full_name || program.name}</DialogTitle>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
            {req.agency && <span><strong>Agency:</strong> {req.agency}</span>}
            {req.cfda && <span><strong>CFDA:</strong> {req.cfda}</span>}
            <span><strong>Period:</strong> {req.period}</span>
            <span><strong>Match:</strong> {req.match}</span>
          </div>
        </DialogHeader>

        {req.purpose && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-semibold mb-1 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Program Purpose</p>
            <p>{req.purpose}</p>
          </div>
        )}

        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance">Compliance Requirements</TabsTrigger>
            <TabsTrigger value="costs">Allowable Costs</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
          </TabsList>

          <TabsContent value="compliance" className="space-y-3 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Requirements are based on FEMA guidance and 2 CFR Part 200. Always refer to the current NOFO and your FEMA Regional Administrator for the most up-to-date requirements.</span>
            </div>
            <RequirementList items={req.compliance_requirements} icon={CheckCircle} color="text-green-600" />
          </TabsContent>

          <TabsContent value="costs" className="pt-2">
            <RequirementList items={req.allowable_costs} icon={DollarSign} color="text-blue-600" />
          </TabsContent>

          <TabsContent value="eligibility" className="pt-2">
            <RequirementList items={req.eligibility} icon={Users} color="text-purple-600" />
          </TabsContent>

          <TabsContent value="reporting" className="pt-2">
            <RequirementList items={req.reporting} icon={FileText} color="text-slate-600" />
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex gap-2">
              <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Performance Period: <strong>{req.period}</strong>. Late or incomplete reports may result in sanctions, award suspension, or termination per 2 CFR §200.338.</span>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}