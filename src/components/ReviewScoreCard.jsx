import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

const CRITERIA_BY_PROGRAM = {
  SHSP: [
    { id: 'feasibility', label: 'Feasibility', weight: 20, description: 'Is the project technically and operationally feasible within the performance period?' },
    { id: 'thira_alignment', label: 'THIRA/SPR Alignment', weight: 25, description: 'How well does the project address THIRA/SPR-identified gaps and priorities?' },
    { id: 'cost_effectiveness', label: 'Cost Effectiveness', weight: 20, description: 'Is the proposed budget reasonable and cost-effective?' },
    { id: 'capability_impact', label: 'Capability Impact', weight: 25, description: 'What is the anticipated impact on the target core capability?' },
    { id: 'sustainability', label: 'Sustainability', weight: 10, description: 'Does the project include a plan for sustaining the capability beyond the grant period?' },
  ],
  NSGP: [
    { id: 'threat_vulnerability', label: 'Threat & Vulnerability', weight: 30, description: 'How well does the vulnerability assessment justify the request?' },
    { id: 'mission_alignment', label: 'Mission Alignment', weight: 20, description: 'How clearly does the mission statement support the grant purpose?' },
    { id: 'cost_effectiveness', label: 'Cost Effectiveness', weight: 25, description: 'Is the proposed budget reasonable and cost-effective?' },
    { id: 'feasibility', label: 'Feasibility', weight: 25, description: 'Is the project technically and operationally feasible?' },
  ],
  EMPG: [
    { id: 'work_plan_quality', label: 'Work Plan Quality', weight: 30, description: 'Are objectives measurable, realistic, and aligned with emergency management activities?' },
    { id: 'match_documentation', label: 'Match Documentation', weight: 25, description: 'Is the cost-share match well-documented and traceable?' },
    { id: 'capability_alignment', label: 'Capability Alignment', weight: 25, description: 'Does the work plan align with core emergency management functions?' },
    { id: 'feasibility', label: 'Feasibility', weight: 20, description: 'Can the proposed activities be completed within the performance period?' },
  ],
  SLCGP: [
    { id: 'cybersecurity_plan', label: 'Cybersecurity Plan Quality', weight: 35, description: 'How comprehensive and actionable is the cybersecurity plan?' },
    { id: 'cisa_alignment', label: 'CISA Guidance Alignment', weight: 25, description: 'How well does the plan align with CISA guidance and priorities?' },
    { id: 'rural_allocation', label: 'Rural Allocation Plan', weight: 20, description: 'Is the rural allocation approach well-defined and equitable?' },
    { id: 'cost_effectiveness', label: 'Cost Effectiveness', weight: 20, description: 'Is the proposed budget reasonable and cost-effective?' },
  ],
  EOC: [
    { id: 'construction_feasibility', label: 'Construction Feasibility', weight: 25, description: 'Is the construction timeline realistic and well-planned?' },
    { id: 'site_control', label: 'Site Control Status', weight: 20, description: 'Has site control been established or is there a clear path to doing so?' },
    { id: 'ehp_readiness', label: 'EHP Readiness', weight: 20, description: 'Has EHP documentation been submitted or prepared?' },
    { id: 'procurement_plan', label: 'Procurement Plan', weight: 20, description: 'Is the procurement plan compliant with 2 CFR 200.317-327?' },
    { id: 'cost_effectiveness', label: 'Cost Effectiveness', weight: 15, description: 'Is the proposed budget reasonable for the scope of construction?' },
  ],
  DEFAULT: [
    { id: 'feasibility', label: 'Feasibility', weight: 25, description: 'Is the project technically and operationally feasible?' },
    { id: 'alignment', label: 'Program Alignment', weight: 25, description: 'How well does the project align with program priorities?' },
    { id: 'cost_effectiveness', label: 'Cost Effectiveness', weight: 25, description: 'Is the proposed budget reasonable and cost-effective?' },
    { id: 'impact', label: 'Impact', weight: 25, description: 'What is the anticipated impact of this project?' },
  ],
};

const scoreColor = (score) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-destructive';
};

export default function ReviewScoreCard({ programCode, scores, notes, onChange }) {
  const criteria = CRITERIA_BY_PROGRAM[programCode] || CRITERIA_BY_PROGRAM.DEFAULT;

  const setScore = (id, val) => onChange({ ...scores, [id]: val[0] });
  const setNote = (id, val) => onChange({ ...scores, [`${id}_note`]: val });

  const weightedTotal = criteria.reduce((sum, c) => {
    const s = scores[c.id] ?? 50;
    return sum + (s * c.weight) / 100;
  }, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Scoring Rubric</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Score each criterion 0–100. Weighted total score is calculated automatically.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Weighted Total</p>
          <p className={`text-2xl font-bold ${scoreColor(weightedTotal)}`}>{weightedTotal.toFixed(1)}</p>
        </div>
      </div>

      <div className="space-y-5">
        {criteria.map(c => {
          const val = scores[c.id] ?? 50;
          return (
            <div key={c.id} className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium text-sm">{c.label}</Label>
                    <Badge variant="outline" className="text-xs">{c.weight}% weight</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-lg font-bold ${scoreColor(val)}`}>{val}</span>
                  <p className="text-xs text-muted-foreground">/100</p>
                </div>
              </div>
              <Slider
                value={[val]}
                min={0}
                max={100}
                step={5}
                onValueChange={v => setScore(c.id, v)}
                className="w-full"
              />
              <div>
                <Label className="text-xs text-muted-foreground">Notes for this criterion (optional)</Label>
                <Textarea
                  rows={1}
                  className="text-xs mt-1"
                  value={scores[`${c.id}_note`] || ''}
                  onChange={e => setNote(c.id, e.target.value)}
                  placeholder="Optional comments..."
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className={`p-3 rounded-lg border flex items-center gap-3 ${weightedTotal >= 70 ? 'bg-green-50 border-green-200' : weightedTotal >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
        <Star className={`h-5 w-5 flex-shrink-0 ${scoreColor(weightedTotal)}`} />
        <div>
          <p className={`font-semibold text-sm ${scoreColor(weightedTotal)}`}>
            {weightedTotal >= 70 ? 'Recommended for Approval' : weightedTotal >= 50 ? 'Marginal — Review Required' : 'Not Recommended'}
          </p>
          <p className="text-xs text-muted-foreground">Weighted score: {weightedTotal.toFixed(1)} / 100</p>
        </div>
      </div>
    </div>
  );
}