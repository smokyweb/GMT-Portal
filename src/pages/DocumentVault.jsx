import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, FileText, Download, Eye, Check, X, Tag, History,
  Search, Filter, ChevronDown, Plus, Trash2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { isStateUser, isAdmin, formatDateShort } from '../lib/helpers';
import { onDocumentUploaded } from '../lib/workflowEngine';
import moment from 'moment';

const DOC_TYPES = ['Invoice', 'PerformanceEvidence', 'Contract', 'BudgetJustification',
  'MatchDocumentation', 'ProgressNarrative', 'FinalReport', 'Other'];

const REVIEW_CONFIG = {
  Pending:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  label: 'Pending Review' },
  Approved: { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Approved' },
  Rejected: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Rejected' },
};

function ReviewBadge({ status = 'Pending' }) {
  const c = REVIEW_CONFIG[status] || REVIEW_CONFIG.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function VersionBadge({ version }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">
      v{version || 1}
    </span>
  );
}

export default function DocumentVault() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterApp, setFilterApp] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', doc_type: 'Invoice', application_id: '', description: '', tags: '', version_of: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef();

  // Review dialog (state admin)
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Version history dialog
  const [versionDoc, setVersionDoc] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      await loadData(u);
    });
  }, []);

  const loadData = async (u) => {
    setLoading(true);
    const role = u?.role || 'user';
    let docList, appList;

    if (isStateUser(role)) {
      [docList, appList] = await Promise.all([
        base44.entities.Document.list('-uploaded_at', 200),
        base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 200),
      ]);
    } else {
      const orgId = u?.organization_id;
      if (!orgId) { setLoading(false); return; }
      [docList, appList] = await Promise.all([
        base44.entities.Document.filter({ organization_id: orgId }, '-uploaded_at', 200),
        base44.entities.Application.filter({ organization_id: orgId }, '-created_date', 50),
      ]);
    }
    setDocs(docList.filter(d => !d.is_template));
    setApps(appList);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!uploadFile && !uploadForm.version_of) {
      alert('Please select a file to upload.');
      return;
    }
    setUploading(true);
    const app = apps.find(a => a.id === uploadForm.application_id);
    let file_url = '';

    if (uploadFile) {
      const result = await base44.integrations.Core.UploadFile({ file: uploadFile });
      file_url = result.file_url;
    }

    // Determine version number
    let version = 1;
    if (uploadForm.version_of) {
      const siblings = docs.filter(d =>
        d.parent_document_id === uploadForm.version_of ||
        d.id === uploadForm.version_of
      );
      version = siblings.length + 1;
    }

    const tags = uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    await base44.entities.Document.create({
      name: uploadForm.name || uploadFile?.name || 'Untitled',
      doc_type: uploadForm.doc_type,
      file_url,
      uploaded_by: user?.email,
      organization_id: user?.organization_id,
      organization_name: app?.organization_name || '',
      application_id: uploadForm.application_id || null,
      application_number: app?.application_number || '',
      description: uploadForm.description,
      tags,
      version,
      parent_document_id: uploadForm.version_of || null,
      review_status: 'Pending',
      uploaded_at: new Date().toISOString(),
    });

    setShowUpload(false);
    setUploadForm({ name: '', doc_type: 'Invoice', application_id: '', description: '', tags: '', version_of: '' });
    setUploadFile(null);
    await loadData(user);
    // Trigger workflow: document uploaded
    if (uploadForm.application_id) {
      await onDocumentUploaded(base44, uploadForm.application_id);
    }
    setUploading(false);
  };

  const handleReview = async (status) => {
    await base44.entities.Document.update(reviewing.id, {
      review_status: status,
      reviewer_email: user?.email,
      reviewer_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
    });
    setReviewing(null);
    setReviewNotes('');
    await loadData(user);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    await base44.entities.Document.delete(doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const openVersionHistory = (doc) => {
    const history = docs.filter(d =>
      d.id === doc.id ||
      d.parent_document_id === doc.id ||
      (doc.parent_document_id && (d.id === doc.parent_document_id || d.parent_document_id === doc.parent_document_id))
    ).sort((a, b) => (a.version || 1) - (b.version || 1));
    setVersionHistory(history);
    setVersionDoc(doc);
  };

  const isState = isStateUser(user?.role);

  // Latest versions only (hide old versions unless viewing history)
  const latestDocs = docs.filter(d => {
    // Show if no children reference it as parent (i.e., it's the latest version)
    const hasNewer = docs.some(other => other.parent_document_id === d.id);
    return !hasNewer;
  });

  const filtered = latestDocs.filter(d => {
    if (filterApp !== 'all' && d.application_id !== filterApp) return false;
    if (filterType !== 'all' && d.doc_type !== filterType) return false;
    if (filterStatus !== 'all' && (d.review_status || 'Pending') !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.name?.toLowerCase().includes(q) &&
          !d.application_number?.toLowerCase().includes(q) &&
          !d.organization_name?.toLowerCase().includes(q) &&
          !(d.tags || []).some(t => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Group by application
  const grouped = {};
  filtered.forEach(d => {
    const key = d.application_id || '__none__';
    if (!grouped[key]) grouped[key] = { label: d.application_number || 'No Application', docs: [] };
    grouped[key].docs.push(d);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!isState && !user?.organization_id) return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No organization linked to your account.</p>
      <p className="text-sm mt-1">Please complete your organization profile first.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isState ? 'View and review grant-related documents from all subrecipients' : 'Upload and manage your grant documents'}
          </p>
        </div>
        {!isState && (
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Upload Document
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Documents', value: latestDocs.length },
          { label: 'Pending Review', value: latestDocs.filter(d => (d.review_status || 'Pending') === 'Pending').length, warn: true },
          { label: 'Approved', value: latestDocs.filter(d => d.review_status === 'Approved').length },
        ].map(s => (
          <div key={s.label} className={`bg-card border rounded-xl p-4 ${s.warn && s.value > 0 ? 'border-amber-200 bg-amber-50/30' : ''}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.warn && s.value > 0 ? 'text-amber-700' : ''}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, app #, tag…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterApp} onValueChange={setFilterApp}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Applications" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applications</SelectItem>
            {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.application_number || a.project_title || a.id}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending Review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents grouped by application */}
      {Object.keys(grouped).length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          {!isState && <p className="text-sm mt-1">Upload your first document using the button above.</p>}
        </div>
      ) : (
        Object.entries(grouped).map(([appId, group]) => (
          <div key={appId} className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{group.label}</span>
              <span className="text-xs text-muted-foreground ml-1">({group.docs.length} doc{group.docs.length !== 1 ? 's' : ''})</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tags</th>
                  {isState && <th className="text-left p-3 font-medium text-muted-foreground">Uploaded By</th>}
                  <th className="text-left p-3 font-medium text-muted-foreground">Uploaded</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {group.docs.map(doc => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          {doc.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</p>}
                        </div>
                        <VersionBadge version={doc.version} />
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {doc.doc_type?.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags || []).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    {isState && (
                      <td className="p-3 text-xs text-muted-foreground">{doc.uploaded_by || '—'}</td>
                    )}
                    <td className="p-3 text-xs text-muted-foreground">
                      {moment(doc.uploaded_at || doc.created_date).fromNow()}
                    </td>
                    <td className="p-3">
                      <ReviewBadge status={doc.review_status || 'Pending'} />
                      {doc.reviewer_notes && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]" title={doc.reviewer_notes}>
                          {doc.reviewer_notes}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                          </a>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openVersionHistory(doc)} title="Version history">
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        {isState && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setReviewing(doc); setReviewNotes(doc.reviewer_notes || ''); }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Review
                          </Button>
                        )}
                        {!isState && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setUploadForm(f => ({ ...f, version_of: doc.id, name: doc.name, doc_type: doc.doc_type, application_id: doc.application_id || '' }));
                              setShowUpload(true);
                            }} title="Upload new version">
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={v => { if (!v) { setShowUpload(false); setUploadForm({ name: '', doc_type: 'Invoice', application_id: '', description: '', tags: '', version_of: '' }); setUploadFile(null); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{uploadForm.version_of ? 'Upload New Version' : 'Upload Document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadForm.version_of && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                Uploading a new version of: <strong>{uploadForm.name}</strong>
              </div>
            )}
            <div>
              <Label>File</Label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  setUploadFile(f);
                  if (f && !uploadForm.name) setUploadForm(prev => ({ ...prev, name: f.name }));
                }} />
                {uploadFile ? (
                  <p className="text-sm font-medium text-primary">{uploadFile.name}</p>
                ) : (
                  <><Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Click to select a file</p></>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Document Name</Label>
                <Input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q1 Invoice" />
              </div>
              <div>
                <Label>Document Type</Label>
                <Select value={uploadForm.doc_type} onValueChange={v => setUploadForm(f => ({ ...f, doc_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Linked Application</Label>
              <Select value={uploadForm.application_id} onValueChange={v => setUploadForm(f => ({ ...f, application_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select application (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {apps.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.application_number || 'Draft'} — {a.project_title || 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description of this document…" />
            </div>
            <div>
              <Label>Tags <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span></Label>
              <Input value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. Q1, equipment, reimbursement" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog (State Admin) */}
      <Dialog open={!!reviewing} onOpenChange={() => { setReviewing(null); setReviewNotes(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{reviewing.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{reviewing.doc_type?.replace(/([A-Z])/g, ' $1').trim()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Application</span><span>{reviewing.application_number || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Uploaded by</span><span>{reviewing.uploaded_by}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><VersionBadge version={reviewing.version} /></div>
                {reviewing.description && <div><span className="text-muted-foreground">Description: </span>{reviewing.description}</div>}
                {(reviewing.tags || []).length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {reviewing.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-muted">{t}</span>)}
                  </div>
                )}
              </div>
              {reviewing.file_url && (
                <a href={reviewing.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full"><Download className="h-3.5 w-3.5 mr-1.5" /> Download & View File</Button>
                </a>
              )}
              <div>
                <Label>Review Notes</Label>
                <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="Add notes for the subrecipient (optional)…" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setReviewing(null); setReviewNotes(''); }}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleReview('Rejected')}>
                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleReview('Approved')}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!versionDoc} onOpenChange={() => setVersionDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version History — {versionDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {versionHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No version history found.</p>}
            {versionHistory.map((v, i) => (
              <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border ${v.id === versionDoc?.id ? 'border-primary/40 bg-primary/5' : ''}`}>
                <div className="flex items-center gap-3">
                  <VersionBadge version={v.version} />
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{moment(v.uploaded_at || v.created_date).format('MMM D, YYYY h:mm A')} · {v.uploaded_by}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ReviewBadge status={v.review_status || 'Pending'} />
                  {v.file_url && (
                    <a href={v.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}