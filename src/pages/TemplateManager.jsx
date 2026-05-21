import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Copy, Archive, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TemplateManager() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    doc_type: 'Other',
    description: '',
    template_body: '',
  });

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const allTemplates = await base44.entities.DocumentTemplate.list('-created_date', 100);
      setTemplates(allTemplates);
      setLoading(false);
    });
  }, []);

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({ name: '', doc_type: 'Other', description: '', template_body: '' });
    setShowDialog(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      doc_type: template.doc_type,
      description: template.description || '',
      template_body: template.template_body || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingTemplate) {
        await base44.entities.DocumentTemplate.update(editingTemplate.id, formData);
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...formData } : t));
      } else {
        const newTemplate = await base44.entities.DocumentTemplate.create(formData);
        setTemplates(prev => [...prev, newTemplate]);
      }
      setShowDialog(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetire = async (id) => {
    if (window.confirm('Retire this template?')) {
      await base44.entities.DocumentTemplate.update(id, { is_active: false });
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleClone = async (template) => {
    const cloned = await base44.entities.DocumentTemplate.create({
      name: `${template.name} (Copy)`,
      doc_type: template.doc_type,
      description: template.description,
      template_body: template.template_body,
      is_active: true,
    });
    setTemplates(prev => [...prev, cloned]);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const activeTemplates = templates.filter(t => t.is_active);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Template Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, manage, and version control document templates</p>
        </div>
        <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> New Template</Button>
      </div>

      {/* Templates Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Created</th>
                <th className="text-center p-3 font-medium">Usage</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTemplates.map(template => (
                <tr key={template.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium">{template.name}</td>
                  <td className="p-3 text-xs text-muted-foreground">{template.doc_type}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(template.created_date).toLocaleDateString()}</td>
                  <td className="p-3 text-center text-xs">—</td>
                  <td className="p-3 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(template)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleClone(template)}><Copy className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleRetire(template.id)}><Archive className="h-3 w-3 text-amber-600" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Template Name</Label>
              <Input className="mt-1" placeholder="e.g., Grant Award Notice" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Document Type</Label>
              <select className="mt-1 w-full border rounded-md p-2 text-sm" value={formData.doc_type} onChange={e => setFormData(f => ({ ...f, doc_type: e.target.value }))}>
                {['Grant Award Notice', 'Subrecipient Agreement', 'Quarterly Report Form', 'Final Report Form', 'Audit Request', 'Budget Modification Form', 'Close-Out Letter', 'Other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1" placeholder="Short description of template purpose" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Template Body</Label>
              <textarea className="mt-1 w-full border rounded-md p-2 text-sm font-mono" rows={8} placeholder='Use {{variable}} syntax for placeholders' value={formData.template_body} onChange={e => setFormData(f => ({ ...f, template_body: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Use {`{{variable}}`} syntax for dynamic fields, e.g., {`{{organization_name}}, {{application_number}}`}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name}>{isSaving ? 'Saving…' : 'Save Template'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}