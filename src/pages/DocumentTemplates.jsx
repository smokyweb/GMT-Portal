import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { FileText, Plus, Send, Trash2, Eye, ChevronDown, ChevronUp, Upload, Paperclip, ExternalLink, History } from 'lucide-react';
import TemplateVersionDialog from '../components/TemplateVersionDialog';
import { formatDateShort } from '../lib/helpers';

const DOC_TYPES = [
  'Grant Award Notice', 'Subrecipient Agreement', 'Quarterly Report Form',
  'Final Report Form', 'Audit Request', 'Budget Modification Form', 'Close-Out Letter', 'Other'
];

const PLACEHOLDERS = [
  { key: '{{organization_name}}', label: 'Organization Name' },
  { key: '{{application_number}}', label: 'Application #' },
  { key: '{{project_title}}', label: 'Project Title' },
  { key: '{{program_code}}', label: 'Program Code' },
  { key: '{{program_name}}', label: 'Program Name' },
  { key: '{{nofo_title}}', label: 'NOFO Title' },
  { key: '{{requested_amount}}', label: 'Requested Amount' },
  { key: '{{awarded_amount}}', label: 'Awarded Amount' },
  { key: '{{match_amount}}', label: 'Match Amount' },
  { key: '{{performance_start}}', label: 'Performance Start' },
  { key: '{{performance_end}}', label: 'Performance End' },
  { key: '{{submitted_by}}', label: 'Submitted By' },
  { key: '{{today_date}}', label: "Today's Date" },
];

function populateTemplate(body, app) {
  const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—';
  const map = {
    '{{organization_name}}': app.organization_name || '—',
    '{{application_number}}': app.application_number || '—',
    '{{project_title}}': app.project_title || '—',
    '{{program_code}}': app.program_code || '—',
    '{{program_name}}': app.program_name || '—',
    '{{nofo_title}}': app.nofo_title || '—',
    '{{requested_amount}}': fmt(app.requested_amount),
    '{{awarded_amount}}': fmt(app.awarded_amount),
    '{{match_amount}}': fmt(app.match_amount),
    '{{performance_start}}': app.performance_start || '—',
    '{{performance_end}}': app.performance_end || '—',
    '{{submitted_by}}': app.submitted_by || '—',
    '{{today_date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
  return body.replace(/\{\{[^}]+\}\}/g, (m) => map[m] || m);
}

export default function DocumentTemplates() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showPhHelp, setShowPhHelp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', doc_type: 'Grant Award Notice', description: '', template_body: '', file_url: '', file_name: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [historyTemplate, setHistoryTemplate] = useState(null);

  // Send dialog
  const [sendTemplate, setSendTemplate] = useState(null);
  const [sendAppId, setSendAppId] = useState('');
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const [tmpl, appList] = await Promise.all([
        base44.entities.DocumentTemplate.list('-created_date', 100),
        base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 200),
      ]);
      setTemplates(tmpl);
      setApps(appList);
      setLoading(false);
    });
  }, []);

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: '', doc_type: 'Grant Award Notice', description: '', template_body: '', file_url: '', file_name: '', is_active: true });
    setShowForm(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url, file_name: file.name }));
    setUploading(false);
  };

  const openEdit = (t) => {
    setEditingTemplate(t);
    setForm({ name: t.name, doc_type: t.doc_type, description: t.description || '', template_body: t.template_body || '', file_url: t.file_url || '', file_name: t.file_name || '', is_active: t.is_active !== false });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (!form.name || (!form.template_body && !form.file_url)) {
      alert('Please provide a template name and either a template body or an uploaded file.');
      setSaving(false);
      return;
    }
    const data = { ...form, created_by_name: user?.full_name };
    if (editingTemplate) {
      // Snapshot current state as a version before overwriting
      const existingVersions = await base44.entities.TemplateVersion.filter({ template_id: editingTemplate.id }, '-version_number', 1);
      const nextVersion = existingVersions.length > 0 ? existingVersions[0].version_number + 1 : 1;
      await base44.entities.TemplateVersion.create({
        template_id: editingTemplate.id,
        template_name: editingTemplate.name,
        version_number: nextVersion,
        name: editingTemplate.name,
        doc_type: editingTemplate.doc_type,
        description: editingTemplate.description || '',
        template_body: editingTemplate.template_body || '',
        file_url: editingTemplate.file_url || '',
        file_name: editingTemplate.file_name || '',
        saved_by: user?.full_name || user?.email,
      });
      await base44.entities.DocumentTemplate.update(editingTemplate.id, data);
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...data } : t));
    } else {
      const created = await base44.entities.DocumentTemplate.create(data);
      setTemplates(prev => [created, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    await base44.entities.DocumentTemplate.delete(t.id);
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  };

  const toggleActive = async (t) => {
    await base44.entities.DocumentTemplate.update(t.id, { is_active: !t.is_active });
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  };

  const openSendDialog = (t) => {
    setSendTemplate(t);
    setSendAppId('');
    setPreview('');
  };

  const handleAppSelect = (appId) => {
    setSendAppId(appId);
    const app = apps.find(a => a.id === appId);
    if (app) setPreview(populateTemplate(sendTemplate.template_body, app));
  };

  const handleSend = async () => {
    if (!sendAppId) return;
    setSending(true);
    const app = apps.find(a => a.id === sendAppId);
    await base44.entities.GeneratedDocument.create({
      template_id: sendTemplate.id,
      template_name: sendTemplate.name,
      doc_type: sendTemplate.doc_type,
      application_id: app.id,
      application_number: app.application_number,
      organization_id: app.organization_id,
      organization_name: app.organization_name,
      populated_body: preview || '',
      file_url: sendTemplate.file_url || '',
      file_name: sendTemplate.file_name || '',
      sent_by: user?.email,
      sent_at: new Date().toISOString(),
      status: 'Sent',
    });
    await base44.entities.Notification.create({
      user_email: app.submitted_by,
      title: `Document Sent for Review: ${sendTemplate.name}`,
      message: `A new document "${sendTemplate.name}" has been sent to you for review and signature. Please check your Documents Inbox.`,
      type: 'document',
      entity_type: 'GeneratedDocument',
      is_read: false,
    });
    setSending(false);
    setSendTemplate(null);
    alert(`Document sent to ${app.organization_name} for review and signature.`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">Create reusable templates with auto-populated fields to send to subrecipients for review and signature.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> New Template</Button>
      </div>

      {/* Template cards */}
      {templates.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Create your first document template to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(t => (
            <div key={t.id} className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-4 ${!t.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{t.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{t.doc_type}</span>
                    {t.file_url && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium flex items-center gap-1"><Paperclip className="h-3 w-3" /> File</span>}
                    {!t.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Created by {t.created_by_name || '—'} · {formatDateShort(t.created_date)}</p>
                  {t.file_url && (
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="h-3 w-3" /> {t.file_name || 'View uploaded file'}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={t.is_active !== false} onCheckedChange={() => toggleActive(t)} />
                <Button variant="ghost" size="sm" onClick={() => setHistoryTemplate(t)} title="Version history">
                  <History className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}><Eye className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                <Button size="sm" onClick={() => openSendDialog(t)} disabled={!t.is_active}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Document Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template Name <span className="text-red-500">*</span></Label>
                <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FY2025 Grant Award Notice" />
              </div>
              <div>
                <Label>Document Type <span className="text-red-500">*</span></Label>
                <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of when to use this template" />
            </div>

            {/* File upload */}
            <div className="border rounded-lg p-4 space-y-2">
              <Label>Upload Template File <span className="text-muted-foreground font-normal">(PDF, Word, Excel)</span></Label>
              <div className="flex items-center gap-3 mt-1">
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />
                  <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition ${uploading ? 'opacity-50 cursor-wait' : 'hover:bg-muted/60 cursor-pointer'}`}>
                    <Upload className="h-4 w-4" />{uploading ? 'Uploading…' : 'Choose File'}
                  </span>
                </label>
                {form.file_url && (
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" /> {form.file_name || 'Uploaded file'}
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Upload an existing document as the template. Subrecipients will be able to download and review it.</p>
            </div>

            {/* Placeholder help */}
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 text-sm font-medium hover:bg-muted/80 transition"
                onClick={() => setShowPhHelp(v => !v)}
              >
                <span>📋 Available Placeholders — click to insert</span>
                {showPhHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showPhHelp && (
                <div className="p-3 flex flex-wrap gap-2 border-t">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.key}
                      className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 font-mono hover:bg-blue-100 transition"
                      onClick={() => setForm(f => ({ ...f, template_body: f.template_body + p.key }))}
                      title={p.label}
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Template Body <span className="text-muted-foreground font-normal text-xs">(optional if file uploaded above)</span></Label>
              <Textarea
                className="mt-1 font-mono text-sm"
                rows={16}
                value={form.template_body}
                onChange={e => setForm(f => ({ ...f, template_body: e.target.value }))}
                placeholder="Enter the document body. Use {{placeholder}} variables where data should be auto-filled..."
              />
              <p className="text-xs text-muted-foreground mt-1">Use the placeholders above to auto-populate application and organization data when sending.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || uploading}>
              {saving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <TemplateVersionDialog
        template={historyTemplate}
        onRevert={(updated) => setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))}
        onClose={() => setHistoryTemplate(null)}
      />

      {/* Send Dialog */}
      <Dialog open={!!sendTemplate} onOpenChange={() => setSendTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Send Document: {sendTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Application (Approved) <span className="text-red-500">*</span></Label>
              <Select value={sendAppId} onValueChange={handleAppSelect}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose an approved application…" /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.application_number || 'Draft'} — {a.organization_name} ({a.program_code || '—'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {apps.length === 0 && <p className="text-xs text-muted-foreground mt-1">No approved applications found.</p>}
            </div>

            {preview && (
              <div>
                <Label>Document Preview (Auto-Populated)</Label>
                <div className="mt-1 border rounded-lg p-4 bg-white text-sm whitespace-pre-wrap font-mono max-h-80 overflow-y-auto leading-relaxed">
                  {preview}
                </div>
                <p className="text-xs text-muted-foreground mt-1">This is exactly what will be sent to the subrecipient for review and signature.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTemplate(null)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !sendAppId}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sending ? 'Sending…' : 'Send for Review & Signature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}