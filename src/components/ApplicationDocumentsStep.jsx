import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Trash2, Check } from 'lucide-react';

const DOC_TYPES = ['BudgetJustification', 'Contract', 'Invoice', 'MatchDocumentation', 'PerformanceEvidence', 'Other'];

export default function ApplicationDocumentsStep({ nofo, app, user, org, onSaveDraft }) {
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [uploading, setUploading] = useState({});
  const [docNames, setDocNames] = useState({});
  const [docTypes, setDocTypes] = useState({});

  useEffect(() => {
    if (app?.id) {
      base44.entities.Document.filter({ application_id: app.id }).then(setUploadedDocs);
    }
  }, [app?.id]);

  const handleUploadRequired = async (doc, file) => {
    setUploading(u => ({ ...u, [doc.name]: true }));
    if (!app?.id) await onSaveDraft();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const created = await base44.entities.Document.create({
      name: doc.name,
      doc_type: 'Other',
      file_url,
      uploaded_by: user?.email,
      organization_id: org?.id || app?.organization_id,
      application_id: app?.id,
      application_number: app?.application_number,
      organization_name: org?.name || app?.organization_name,
      uploaded_at: new Date().toISOString(),
    });
    setUploadedDocs(prev => [...prev.filter(d => d.name !== doc.name), created]);
    setUploading(u => ({ ...u, [doc.name]: false }));
  };

  const handleUploadGeneral = async (file, tempKey) => {
    setUploading(u => ({ ...u, [tempKey]: true }));
    if (!app?.id) await onSaveDraft();
    const name = docNames[tempKey] || file.name;
    const docType = docTypes[tempKey] || 'Other';
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const created = await base44.entities.Document.create({
      name,
      doc_type: docType,
      file_url,
      uploaded_by: user?.email,
      organization_id: org?.id || app?.organization_id,
      application_id: app?.id,
      application_number: app?.application_number,
      organization_name: org?.name || app?.organization_name,
      uploaded_at: new Date().toISOString(),
    });
    setUploadedDocs(prev => [...prev, created]);
    setUploading(u => ({ ...u, [tempKey]: false }));
  };

  const handleDelete = async (docId) => {
    await base44.entities.Document.delete(docId);
    setUploadedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const triggerFileInput = (onFile) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
    input.onchange = (e) => { if (e.target.files[0]) onFile(e.target.files[0]); };
    input.click();
  };

  const requiredDocs = nofo?.required_documents || [];
  const generalDocs = uploadedDocs.filter(d => !requiredDocs.find(r => r.name === d.name));

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-lg">Documents</h2>

      {/* Required Documents */}
      {requiredDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Required Documents</p>
          {requiredDocs.map((doc, i) => {
            const uploaded = uploadedDocs.find(d => d.name === doc.name);
            return (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  {uploaded ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.mandatory ? 'Required' : 'Optional'}
                      {uploaded && <span className="ml-2 text-green-600">· Uploaded</span>}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading[doc.name]}
                  onClick={() => triggerFileInput(file => handleUploadRequired(doc, file))}
                >
                  {uploading[doc.name] ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* General / Supporting Documents */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Supporting Documents
        </p>
        {requiredDocs.length === 0 && (
          <p className="text-sm text-muted-foreground">No specific documents are required for this NOFO. You may upload any supporting materials below.</p>
        )}

        {/* Existing general uploads */}
        {generalDocs.length > 0 && (
          <div className="space-y-2">
            {generalDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.doc_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm">View</Button>
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New upload row */}
        <NewDocumentRow
          onUpload={handleUploadGeneral}
          uploading={uploading}
          docNames={docNames}
          setDocNames={setDocNames}
          docTypes={docTypes}
          setDocTypes={setDocTypes}
        />
      </div>
    </div>
  );
}

function NewDocumentRow({ onUpload, uploading, docNames, setDocNames, docTypes, setDocTypes }) {
  const [tempKey] = useState(() => `new_${Date.now()}`);
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!docNames[tempKey]) setDocNames(n => ({ ...n, [tempKey]: f.name }));
  };

  const handleSubmit = async () => {
    if (!file) return;
    await onUpload(file, tempKey);
    setFile(null);
  };

  return (
    <div className="p-4 rounded-lg border border-dashed space-y-3">
      <p className="text-sm font-medium">Upload a document</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input
            placeholder="Document name"
            value={docNames[tempKey] || ''}
            onChange={e => setDocNames(n => ({ ...n, [tempKey]: e.target.value }))}
          />
        </div>
        <div>
          <Select value={docTypes[tempKey] || 'Other'} onValueChange={v => setDocTypes(t => ({ ...t, [tempKey]: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-transparent text-sm hover:bg-accent transition">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground truncate">{file ? file.name : 'Choose file…'}</span>
          </div>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileChange} />
        </label>
        <Button size="sm" disabled={!file || uploading[tempKey]} onClick={handleSubmit}>
          {uploading[tempKey] ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}