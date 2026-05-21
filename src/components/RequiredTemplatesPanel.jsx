import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function RequiredTemplatesPanel({ entityType, entityId, requiredTemplateIds = [], onUpdate, isAdmin = false }) {
  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [requiredTemplateIds]);

  const loadTemplates = async () => {
    setLoading(true);
    const all = await base44.entities.DocumentTemplate.filter({ is_active: true });
    setAllTemplates(all);
    const required = all.filter(t => requiredTemplateIds.includes(t.id));
    setTemplates(required);
    setLoading(false);
  };

  const handleToggle = async (templateId, checked) => {
    const updated = checked
      ? [...requiredTemplateIds, templateId]
      : requiredTemplateIds.filter(id => id !== templateId);
    await onUpdate(updated);
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading required templates…</div>;

  if (!isAdmin) {
    if (templates.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">Required Documents</p>
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span>{t.name}</span>
            <span className="text-xs text-muted-foreground">({t.doc_type})</span>
          </div>
        ))}
      </div>
    );
  }

  const relevant = allTemplates.filter(t =>
    !t.applies_to?.length || t.applies_to.includes(entityType) || t.applies_to.includes('General')
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Required Templates</p>
        <Button variant="ghost" size="sm" onClick={() => setManaging(m => !m)}>
          {managing ? 'Done' : 'Manage'}
        </Button>
      </div>

      {managing ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {relevant.length === 0 && <p className="text-xs text-muted-foreground">No templates available for this type.</p>}
          {relevant.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded">
              <Checkbox
                checked={requiredTemplateIds.includes(t.id)}
                onCheckedChange={(checked) => handleToggle(t.id, checked)}
              />
              <span>{t.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{t.doc_type}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {templates.length === 0 && <p className="text-xs text-muted-foreground">No required templates assigned.</p>}
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>{t.name}</span>
              <span className="text-xs text-muted-foreground">({t.doc_type})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}