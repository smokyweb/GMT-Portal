import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

const EHP_QUESTIONS = [
  {
    id: 'q1',
    question: 'Does the project involve ground disturbance, excavation, or any digging?',
    flag: true,
    flagNote: 'Archaeological survey may be required under NHPA Section 106.',
  },
  {
    id: 'q2',
    question: 'Does the project involve construction, renovation, or physical alteration of a building or structure?',
    flag: true,
    flagNote: 'NEPA environmental review and Section 106 consultation required before work begins.',
  },
  {
    id: 'q3',
    question: 'Is the project located in a floodplain (FEMA SFHA or 500-year floodplain)?',
    flag: true,
    flagNote: '8-step process required. Floodplain development permit may be needed.',
  },
  {
    id: 'q4',
    question: 'Is the project located on or near a property listed or eligible for the National Register of Historic Places?',
    flag: true,
    flagNote: 'Section 106 consultation with SHPO required.',
  },
  {
    id: 'q5',
    question: 'Does the project affect coastal zones, wetlands, or other sensitive environmental areas?',
    flag: true,
    flagNote: 'Coastal Zone Management Act consistency determination may be required.',
  },
  {
    id: 'q6',
    question: 'Does the project involve the installation of towers, antennas, or communications equipment?',
    flag: true,
    flagNote: 'FCC Tower Construction notification may apply. Section 106 review required.',
  },
  {
    id: 'q7',
    question: 'Could the project impact threatened or endangered species or their habitat?',
    flag: true,
    flagNote: 'Section 7 ESA consultation with US Fish & Wildlife Service may be required.',
  },
  {
    id: 'q8',
    question: 'Does the project involve hazardous materials, contaminated sites, or underground storage tanks?',
    flag: true,
    flagNote: 'Phase I/II Environmental Site Assessment may be required.',
  },
  {
    id: 'q9',
    question: 'Is the project located in a tribal area or does it affect tribal lands or cultural resources?',
    flag: true,
    flagNote: 'Government-to-government tribal consultation required.',
  },
  {
    id: 'q10',
    question: 'Is this project a planning, training, or exercise activity only (no physical work)?',
    flag: false,
  },
];

export default function EHPScreening({ form, onChange }) {
  const answers = form.ehp_screening_answers || {};
  const setAnswer = (id, val) => {
    const updated = { ...answers, [id]: val };
    const hasFlag = EHP_QUESTIONS.some(q => q.flag && updated[q.id] === 'yes');
    onChange({
      ...form,
      ehp_screening_answers: updated,
      ehp_required: hasFlag,
      ehp_status: hasFlag ? (form.ehp_status === 'NotRequired' ? 'ScreeningRequired' : form.ehp_status || 'ScreeningRequired') : 'NotRequired',
    });
  };

  const flaggedQuestions = EHP_QUESTIONS.filter(q => q.flag && answers[q.id] === 'yes');
  const allAnswered = EHP_QUESTIONS.every(q => answers[q.id]);
  const ehpRequired = flaggedQuestions.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-sm">EHP Pre-Screening Questionnaire</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Answer all questions honestly. EHP review is required before construction or installation begins. Failing to submit EHP documentation early can delay your award.
        </p>
      </div>

      <div className="space-y-4">
        {EHP_QUESTIONS.map((q, i) => (
          <div key={q.id} className="p-3 rounded-lg border bg-card space-y-2">
            <Label className="text-sm font-medium">
              {i + 1}. {q.question}
            </Label>
            <Select value={answers[q.id] || ''} onValueChange={v => setAnswer(q.id, v)}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="unknown">Unknown / Unsure</SelectItem>
              </SelectContent>
            </Select>
            {q.flag && answers[q.id] === 'yes' && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{q.flagNote}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* EHP Notes */}
      <div>
        <Label className="text-sm">Additional EHP Notes (optional)</Label>
        <Textarea
          rows={3}
          value={form.ehp_notes || ''}
          onChange={e => onChange({ ...form, ehp_notes: e.target.value })}
          placeholder="Provide any additional context, current EHP status, or notes for reviewers..."
        />
      </div>

      {/* Result Banner */}
      {allAnswered && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${ehpRequired ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
          {ehpRequired ? (
            <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-semibold text-sm ${ehpRequired ? 'text-amber-800' : 'text-green-800'}`}>
              {ehpRequired ? `EHP Review Required (${flaggedQuestions.length} flag${flaggedQuestions.length > 1 ? 's' : ''} identified)` : 'No EHP Review Triggered'}
            </p>
            <p className={`text-xs mt-0.5 ${ehpRequired ? 'text-amber-700' : 'text-green-700'}`}>
              {ehpRequired
                ? 'You must upload EHP documentation in the Documents step and receive FEMA EHP approval before any physical work begins.'
                : 'Based on your answers, this project does not appear to require EHP review. Reviewers may follow up with additional questions.'}
            </p>
          </div>
        </div>
      )}

      {!allAnswered && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-xs">
          <Info className="h-4 w-4 flex-shrink-0" />
          Please answer all questions to complete the EHP screening.
        </div>
      )}
    </div>
  );
}