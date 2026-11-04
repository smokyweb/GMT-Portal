import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RequiredTemplatesPanel({ entityType, entityId, requiredTemplateIds = [], requiredTemplateAssignments = [], assignmentMode = false, onUpdate, isAdmin = false }) {
  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);

  useEffect(() => { loadTemplates(); }, [requiredTemplateIds, requiredTemplateAssignments, assignmentMode]);

  const loadTemplates = async () => {
    setLoading(true);
    const all = await base44.entities.DocumentTemplate.filter({ is_active: true });
    setAllTemplates(all);
    const required = assignmentMode
      ? all.filter(t => requiredTemplateAssignments.some(a => a.template_id === t.id))
      : all.filter(t => requiredTemplateIds.includes(t.id));
    setTemplates(required);
    setLoading(false);
  };

  const assignmentFor = templateId => requiredTemplateAssignments.find(item => item.template_id === templateId);
  const handleAssignment = async (template, value) => {
    const next = requiredTemplateAssignments.filter(item => item.template_id !== template.id);
    if (value !== 'none') {
      next.push({
        template_id: template.id,
        name: template.name,
        description: template.description || '',
        mandatory: value === 'required',
        template_use: template.template_use || (template.doc_type === 'Grant Award Notice' ? 'Generated Document' : 'Attachment'),
        template_file_url: template.file_url || '',
        template_file_name: template.file_name || '',
      });
    }
    await onUpdate(next);
  };

  const handleToggle = async (templateId, checked) => {
    const updated = checked ? [...requiredTemplateIds, templateId] : requiredTemplateIds.filter(id => id !== templateId);
    await onUpdate(updated);
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading required templates…</div>;

  if (!isAdmin) {
    if (templates.length === 0) return null;
    return <div className="space-y-2"><p className="text-sm font-semibold">Required Documents</p>{templates.map(t => <div key={t.id} className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" /><span>{t.name}</span><span className="text-xs text-muted-foreground">({t.doc_type})</span></div>)}</div>;
  }

  const relevant = allTemplates.filter(t => !t.applies_to?.length || t.applies_to.includes(entityType) || t.applies_to.includes('General'));
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-sm font-semibold">Required Templates</p><Button variant="ghost" size="sm" onClick={() => setManaging(m => !m)}>{managing ? 'Done' : 'Manage'}</Button></div>
    {managing ? <div className="space-y-2 max-h-64 overflow-y-auto">
      {relevant.length === 0 && <p className="text-xs text-muted-foreground">No templates available for this type.</p>}
      {relevant.map(t => assignmentMode ? <div key={t.id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted/30"><span className="flex-1">{t.name}</span><span className="text-xs text-muted-foreground">{t.template_use || (t.doc_type === 'Grant Award Notice' ? 'Generated Document' : 'Attachment')}</span><Select value={assignmentFor(t.id) ? (assignmentFor(t.id).mandatory ? 'required' : 'optional') : 'none'} onValueChange={value => handleAssignment(t, value)}><SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem><SelectItem value="required">Required</SelectItem><SelectItem value="optional">Optional</SelectItem></SelectContent></Select></div> : <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded"><Checkbox checked={requiredTemplateIds.includes(t.id)} onCheckedChange={checked => handleToggle(t.id, checked)} /><span>{t.name}</span><span className="text-xs text-muted-foreground ml-auto">{t.doc_type}</span></label>)}
    </div> : <div className="space-y-1">{templates.length === 0 && <p className="text-xs text-muted-foreground">No required templates assigned.</p>}{templates.map(t => <div key={t.id} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" /><span>{t.name}</span>{assignmentMode && <span className="text-xs text-muted-foreground">({assignmentFor(t.id)?.mandatory ? 'Required' : 'Optional'})</span>}<span className="text-xs text-muted-foreground">({t.template_use || t.doc_type})</span></div>)}</div>}
  </div>;
}
