import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, FileText, Download, Eye, History,
  Search, Plus, Trash2, PenLine, CheckCircle, XCircle, Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isStateUser, formatDateShort } from '../lib/helpers';
import { onDocumentUploaded } from '../lib/workflowEngine';
import SignaturePad from '../components/SignaturePad';
import InlinePdfViewer from '../components/InlinePdfViewer';
import moment from 'moment';

const BASE_DOC_TYPES = ['Invoice', 'PerformanceEvidence', 'Contract', 'BudgetJustification',
  'MatchDocumentation', 'ProgressNarrative', 'FinalReport', 'Other'];

const REVIEW_CONFIG = {
  Pending:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  label: 'Pending Review' },
  Approved: { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Approved' },
  Rejected: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Rejected' },
};

const INBOX_CONFIG = {
  Sent:     { label: 'Awaiting Review',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  Reviewed: { label: 'Reviewed',         bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  Signed:   { label: 'Signed',           bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  Rejected: { label: 'Rejected',         bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
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

function InboxBadge({ status }) {
  const c = INBOX_CONFIG[status] || INBOX_CONFIG.Sent;
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

const BLANK_UPLOAD = { name: '', doc_type: '', application_id: '', description: '', tags: '', version_of: '', organization_id: '', recipient: '', subrecipient: '' };

export default function Documents() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [receivedDocs, setReceivedDocs] = useState([]);
  const [apps, setApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [appSearch, setAppSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [customDocTypes, setCustomDocTypes] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterApp, setFilterApp] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState(BLANK_UPLOAD);
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef();

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState(null);

  // Version history dialog
  const [versionDoc, setVersionDoc] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);

  // Received doc dialog (subrecipient)
   const [selectedReceived, setSelectedReceived] = useState(null);
   const [receivedNotes, setReceivedNotes] = useState('');
   const [acting, setActing] = useState(false);
   const [showSignaturePad, setShowSignaturePad] = useState(false);
   const [signatureData, setSignatureData] = useState(null);

   // Assign orphaned doc
   const [assigningDoc, setAssigningDoc] = useState(null);
   const [assigningAppId, setAssigningAppId] = useState('');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const [, settings] = await Promise.all([
        loadData(u),
        base44.entities.AppSettings.filter({ key: 'document_review' }).catch(() => []),
      ]);
      if (settings?.length > 0) {
        setCustomDocTypes(settings[0].value?.custom_types || []);
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async (u) => {
    setLoading(true);

    let docList, appList, receivedList;

    if (u && !['isc_admin', 'federal_admin', 'federal_officer'].includes(u.role)) {
      if (u.role === 'admin' && u.scope_state) {
        // State admin: see docs from orgs in their state
        const allOrgs = await base44.entities.Organization.list();
        const orgIds = allOrgs.filter(o => o.state === u.scope_state).map(o => o.id);
        docList = await base44.entities.Document.list('-uploaded_at', 200);
        docList = docList.filter(d => orgIds.includes(d.organization_id));
        appList = await base44.entities.Application.filter({ status: 'Approved' }, '-created_date', 200);
        appList = appList.filter(a => orgIds.includes(a.organization_id));
        receivedList = await base44.entities.GeneratedDocument.list('-sent_at', 200);
        receivedList = receivedList.filter(gd => orgIds.includes(gd.organization_id));
      } else if (u.role === 'user' && u.organization_id) {
        // Subrecipient: see only their organization's docs
        [docList, appList, receivedList] = await Promise.all([
          base44.entities.Document.filter({ organization_id: u.organization_id }, '-uploaded_at', 200).catch(() => []),
          base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 50).catch(() => []),
          base44.entities.GeneratedDocument.filter({ organization_id: u.organization_id }, '-sent_at', 100).catch(() => []),
        ]);
        // Load their org so uploads get correct organization_name
        const userOrgList = await base44.entities.Organization.list('-created_date', 500).catch(() => []);
        const userOrg = userOrgList.find(o => o.id === u.organization_id);
        if (userOrg) setOrgs([userOrg]);
      } else {
        // admin without scope_state: see all docs
        docList = await base44.entities.Document.list('-uploaded_at', 200);
        appList = await base44.entities.Application.list('-created_date', 200);
        receivedList = await base44.entities.GeneratedDocument.list('-sent_at', 200);
        const orgList = await base44.entities.Organization.list('-created_date', 200);
        setOrgs(orgList || []);
      }
    } else {
      // ISC/federal: see all
      docList = await base44.entities.Document.list('-uploaded_at', 200);
      appList = await base44.entities.Application.list('-created_date', 200);
      receivedList = await base44.entities.GeneratedDocument.list('-sent_at', 200);
      const orgList = await base44.entities.Organization.list('-created_date', 200);
      setOrgs(orgList || []);
    }

    setDocs((docList || []).filter(d => !d.is_template));
    setApps(appList || []);
    setReceivedDocs(receivedList || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!uploadForm.doc_type) { alert('Please select a document type.'); return; }
    if (!uploadFile && !uploadForm.version_of) {
      alert('Please select a file to upload.');
      return;
    }
    setUploading(true);
    const app = apps.find(a => a.id === uploadForm.application_id);
    let file_url = '';
    if (uploadFile) {
      try {
        const formData = new FormData();
        formData.append('file', uploadFile);
        const token = localStorage.getItem('gmt_token');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) { const data = await res.json(); file_url = data.url || ''; }
      } catch (uploadErr) {
        console.warn('File upload failed, saving record without URL:', uploadErr.message);
      }
    }
    let version = 1;
    if (uploadForm.version_of) {
      const siblings = docs.filter(d => d.parent_document_id === uploadForm.version_of || d.id === uploadForm.version_of);
      version = siblings.length + 1;
    }
    const tags = uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const selectedOrg = orgs.find(o => o.id === uploadForm.organization_id);
    await base44.entities.Document.create({
      name: uploadForm.name || uploadFile?.name || 'Untitled',
      doc_type: uploadForm.doc_type,
      file_url,
      uploaded_by: user?.email,
      organization_id: uploadForm.organization_id || app?.organization_id || user?.organization_id,
      organization_name: selectedOrg?.name || app?.organization_name || '',
      application_id: uploadForm.application_id || null,
      application_number: app?.application_number || '',
      recipient: uploadForm.recipient || null,
      subrecipient: uploadForm.subrecipient || null,
      description: uploadForm.description,
      tags,
      version,
      parent_document_id: uploadForm.version_of || null,
      review_status: 'Pending',
      uploaded_at: new Date().toISOString(),
    });
    try {
      if (uploadForm.application_id) await onDocumentUploaded(base44, uploadForm.application_id);
    } catch (e) { console.warn('Post-upload hook failed:', e); }
    setShowUpload(false);
    setUploadForm(BLANK_UPLOAD);
    setUploadFile(null);
    setAppSearch('');
    await loadData(user);
    setUploading(false);
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

  const handleReceivedAction = async (action) => {
    setActing(true);
    const update = {
      status: action,
      subrecipient_notes: receivedNotes,
      ...(action === 'Signed' ? { signed_at: new Date().toISOString(), signed_by: user?.email, signature_data: signatureData } : {}),
    };
    await base44.entities.GeneratedDocument.update(selectedReceived.id, update);
    await base44.entities.Notification.create({
      user_email: selectedReceived.sent_by,
      title: `Document ${action}: ${selectedReceived.template_name}`,
      message: `${selectedReceived.organization_name} has ${action.toLowerCase()} the document "${selectedReceived.template_name}".${receivedNotes ? ` Notes: ${receivedNotes}` : ''}`,
      type: 'document',
      entity_type: 'GeneratedDocument',
      entity_id: selectedReceived.id,
      is_read: false,
    });
    setReceivedDocs(prev => prev.map(d => d.id === selectedReceived.id ? { ...d, ...update } : d));
    setActing(false);
    setSelectedReceived(null);
    setReceivedNotes('');
    setSignatureData(null);
    setShowSignaturePad(false);
  };

  const isState = isStateUser(user?.role);
  const DOC_TYPES = [...BASE_DOC_TYPES, ...customDocTypes];

  const latestDocs = docs.filter(d => !docs.some(other => other.parent_document_id === d.id));

  const filteredDocs = latestDocs.filter(d => {
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

  // For "Uploads" tab: docs uploaded by current user (subrecipient) or all (state)
  const uploadedDocs = isState
    ? filteredDocs
    : filteredDocs.filter(d => d.uploaded_by === user?.email);

  // For "Shared" tab: docs uploaded by state admins visible to subrecipients, or all non-user docs for state
  const sharedDocs = isState
    ? filteredDocs.filter(d => d.uploaded_by !== user?.email)
    : filteredDocs.filter(d => d.uploaded_by !== user?.email);

  const handleAssignDoc = async () => {
    if (!assigningDoc || !assigningAppId) return;
    const selectedApp = apps.find(a => a.id === assigningAppId);
    await base44.entities.Document.update(assigningDoc.id, {
      application_id: assigningAppId,
      application_number: selectedApp?.application_number || '',
    });
    setAssigningDoc(null);
    setAssigningAppId('');
    await loadData(user);
  };

  const grouped = (list) => {
    const g = {};
    list.forEach(d => {
      const key = d.application_id || '__none__';
      if (!g[key]) {
        // Look up app number from the apps array since document.application_number may be blank
        const linkedApp = apps.find(a => a.id === d.application_id);
        const appLabel = linkedApp
          ? `${linkedApp.application_number || 'Draft'} - ${linkedApp.project_title || linkedApp.organization_name || ''}`
          : (d.application_number || d.application_id ? (d.application_number || d.application_id.slice(0, 8)) : null);
        g[key] = { label: appLabel || 'Unassigned Documents', appId: d.application_id, docs: [] };
      }
      g[key].docs.push(d);
    });
    return g;
  };

  const pendingReceived = receivedDocs.filter(d => d.status === 'Sent' || d.status === 'Reviewed');
  const completedReceived = receivedDocs.filter(d => d.status === 'Signed' || d.status === 'Rejected');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!isState && !user?.organization_id) return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No organization linked to your account.</p>
    </div>
  );

  const DocTable = ({ list, showOrg = false }) => {
    const g = grouped(list);
    if (Object.keys(g).length === 0) return (
      <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No documents found</p>
      </div>
    );
    return (
      <div className="space-y-4">
        {Object.entries(g).map(([appId, group]) => (
          <div key={appId} className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{group.label}</span>
              <span className="text-xs text-muted-foreground ml-1">({group.docs.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                    {showOrg && <th className="text-left p-3 font-medium text-muted-foreground">Uploaded By</th>}
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
                      {showOrg && <td className="p-3 text-xs text-muted-foreground">{doc.uploaded_by || ' - '}</td>}
                      <td className="p-3 text-xs text-muted-foreground">{moment(doc.uploaded_at || doc.created_date).fromNow()}</td>
                      <td className="p-3">
                        <ReviewBadge status={doc.review_status || 'Pending'} />
                        {doc.reviewer_notes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]" title={doc.reviewer_notes}>{doc.reviewer_notes}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {doc.file_url && (
                            <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(doc)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          )}
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                            </a>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openVersionHistory(doc)} title="Version history">
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          {!doc.application_id && (
                            <div className="relative group">
                              <Button variant="outline" size="sm" className="text-xs" title="Assign to application">
                                Link App
                              </Button>
                              <div className="hidden group-hover:block absolute right-0 z-50 mt-1 bg-white border rounded-lg shadow-lg p-2 min-w-[220px]">
                                <p className="text-xs font-semibold px-2 py-1 text-muted-foreground">Select application:</p>
                                {apps.length > 0 ? (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {apps.map(a => (
                                      <button key={a.id} onClick={() => { setAssigningDoc(doc); setAssigningAppId(a.id); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded">
                                        <p className="font-medium">{a.application_number || 'Draft'}</p>
                                        <p className="text-muted-foreground truncate">{a.project_title || 'Untitled'}</p>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground px-2 py-2">No applications available</p>
                                )}
                              </div>
                            </div>
                          )}
                          {!isState && (
                            <>
                              <Button variant="ghost" size="sm" title="Upload new version" onClick={() => {
                                setUploadForm(f => ({ ...f, version_of: doc.id, name: doc.name, doc_type: doc.doc_type, application_id: doc.application_id || '' }));
                                setShowUpload(true);
                              }}>
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
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isState ? 'Review and manage all grant documents' : 'Upload, track, and sign your grant documents'}
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-1.5" /> Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Documents', value: latestDocs.length },
          { label: 'Pending Review', value: latestDocs.filter(d => (d.review_status || 'Pending') === 'Pending').length, warn: true },
          { label: isState ? 'Received Sent' : 'Documents Received', value: receivedDocs.length },
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
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending Review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="uploads">
        <TabsList>
          <TabsTrigger value="uploads">
            {isState ? 'All Uploads' : 'My Uploads'}
            {uploadedDocs.length > 0 && <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{uploadedDocs.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="received">
            Received
            {pendingReceived.length > 0 && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pendingReceived.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="shared">
            Shared
            {sharedDocs.length > 0 && <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sharedDocs.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* UPLOADS TAB */}
        <TabsContent value="uploads" className="mt-4">
          <DocTable list={uploadedDocs} showOrg={isState} />
        </TabsContent>

        {/* RECEIVED TAB */}
        <TabsContent value="received" className="mt-4">
          {receivedDocs.length === 0 ? (
            <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No received documents</p>
              <p className="text-sm mt-1">{isState ? 'Documents sent to subrecipients will appear here.' : 'Documents sent by the state for your review and signature will appear here.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingReceived.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending Action ({pendingReceived.length})</p>
                  <div className="grid gap-3">
                    {pendingReceived.map(doc => (
                      <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <PenLine className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{doc.template_name}</p>
                            <p className="text-xs text-muted-foreground">{doc.doc_type} · App {doc.application_number || ' - '}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Sent {moment(doc.sent_at).fromNow()} by {doc.sent_by}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <InboxBadge status={doc.status} />
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                            </a>
                          )}
                          {!isState && (
                            <Button size="sm" onClick={() => { setSelectedReceived(doc); setReceivedNotes(doc.subrecipient_notes || ''); }}>
                              Review & Sign
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {completedReceived.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Completed ({completedReceived.length})</p>
                  <div className="grid gap-3">
                    {completedReceived.map(doc => (
                      <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4 opacity-80">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.status === 'Signed' ? 'bg-green-50' : 'bg-red-50'}`}>
                            {doc.status === 'Signed' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-500" />}
                          </div>
                          <div>
                            <p className="font-semibold">{doc.template_name}</p>
                            <p className="text-xs text-muted-foreground">{doc.doc_type} · App {doc.application_number || ' - '}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {doc.status === 'Signed' ? `Signed ${moment(doc.signed_at).fromNow()} by ${doc.signed_by}` : `Rejected ${moment(doc.updated_date).fromNow()}`}
                            </p>
                            {doc.subrecipient_notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{doc.subrecipient_notes}"</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <InboxBadge status={doc.status} />
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                            </a>
                          )}
                          <Button variant="outline" size="sm" onClick={() => { setSelectedReceived(doc); setReceivedNotes(doc.subrecipient_notes || ''); }}>View</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* SHARED TAB */}
        <TabsContent value="shared" className="mt-4">
          <DocTable list={sharedDocs} showOrg={true} />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={v => { if (!v) { setShowUpload(false); setUploadForm(BLANK_UPLOAD); setUploadFile(null); setAppSearch(''); }}}>
        <DialogContent className="!left-auto !right-4 !translate-x-0 w-[calc(100vw-5rem)] max-w-lg max-h-[90vh] flex flex-col overflow-hidden sm:!left-[50%] sm:!right-auto sm:!translate-x-[-50%]">
          <DialogHeader>
            <DialogTitle>{uploadForm.version_of ? 'Upload New Version' : 'Upload Document'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                {uploadFile
                  ? <p className="text-sm font-medium text-primary">{uploadFile.name}</p>
                  : <><Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Click to select a file</p></>
                }
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
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Admin-only: Organization, Recipient, Subrecipient */}
            {isState && (
              <>
                <div>
                  <Label>Organization</Label>
                  <Select value={uploadForm.organization_id || '__none__'} onValueChange={v => setUploadForm(f => ({ ...f, organization_id: v === '__none__' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select organization (optional)" /></SelectTrigger>
                    <SelectContent className="max-h-48 overflow-y-auto">
                      <SelectItem value="__none__">None</SelectItem>
                      {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name || o.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Recipient</Label>
                    <Input value={uploadForm.recipient} onChange={e => setUploadForm(f => ({ ...f, recipient: e.target.value }))} placeholder="Recipient name or email" />
                  </div>
                  <div>
                    <Label>Subrecipient</Label>
                    <Input value={uploadForm.subrecipient} onChange={e => setUploadForm(f => ({ ...f, subrecipient: e.target.value }))} placeholder="Subrecipient name" />
                  </div>
                </div>
              </>
            )}

            {/* Searchable Application */}
            <div>
              <Label>Linked Application</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 text-sm"
                  placeholder="Search app number or title…"
                  value={appSearch}
                  onChange={e => { setAppSearch(e.target.value); if (!e.target.value) setUploadForm(f => ({ ...f, application_id: '' })); }}
                />
              </div>
              {appSearch && (
                <div className="border rounded-lg mt-1 max-h-40 overflow-y-auto bg-background shadow-md">
                  <div className="px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50" onClick={() => { setUploadForm(f => ({ ...f, application_id: '' })); setAppSearch(''); }}>None / Clear</div>
                  {apps.filter(a =>
                    a.application_number?.toLowerCase().includes(appSearch.toLowerCase()) ||
                    a.project_title?.toLowerCase().includes(appSearch.toLowerCase()) ||
                    a.organization_name?.toLowerCase().includes(appSearch.toLowerCase())
                  ).map(a => (
                    <div key={a.id}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 ${uploadForm.application_id === a.id ? 'bg-primary/10 font-medium' : ''}`}
                      onClick={() => { setUploadForm(f => ({ ...f, application_id: a.id })); setAppSearch(`${a.application_number || 'Draft'} - ${a.project_title || 'Untitled'}`); }}
                    >
                      <span className="font-medium">{a.application_number || 'Draft'}</span> - {a.project_title || 'Untitled'}
                      {a.organization_name && <span className="text-xs text-muted-foreground ml-1">({a.organization_name})</span>}
                    </div>
                  ))}
                </div>
              )}
              {uploadForm.application_id && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  ✓ Linked: {apps.find(a => a.id === uploadForm.application_id)?.application_number || 'Selected'}
                  {' '}<a href={`/applications/${uploadForm.application_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">Open ↗</a>
                  {' '}<button className="text-red-400 hover:text-red-600 ml-1" onClick={() => { setUploadForm(f => ({ ...f, application_id: '' })); setAppSearch(''); }}>✕ Clear</button>
                </p>
              )}
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description…" />
            </div>
            <div>
              <Label>Tags <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span></Label>
              <Input value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. Q1, equipment, reimbursement" />
            </div>
          </div>
          <DialogFooter className="pt-4 flex flex-row gap-2 justify-end flex-shrink-0">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { setShowUpload(false); setUploadForm(BLANK_UPLOAD); setUploadFile(null); setAppSearch(''); }}>Cancel</Button>
            <Button className="flex-1 sm:flex-none" onClick={handleUpload} disabled={uploading || !uploadFile}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>{previewDoc?.name}</DialogTitle>
              {previewDoc?.file_url && (
                <a href={previewDoc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1.5" /> Download</Button>
                </a>
              )}
            </div>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Type</span><p className="font-medium">{previewDoc.doc_type?.replace(/([A-Z])/g, ' $1').trim()}</p></div>
                <div><span className="text-muted-foreground text-xs">Application</span><p className="font-medium font-mono">{previewDoc.application_number || ' - '}</p></div>
                <div><span className="text-muted-foreground text-xs">Uploaded by</span><p className="font-medium">{previewDoc.uploaded_by || ' - '}</p></div>
                <div><span className="text-muted-foreground text-xs">Uploaded</span><p className="font-medium">{moment(previewDoc.uploaded_at || previewDoc.created_date).format('MMM D, YYYY')}</p></div>
                {previewDoc.description && <div className="col-span-2"><span className="text-muted-foreground text-xs">Description</span><p className="font-medium">{previewDoc.description}</p></div>}
              </div>
              {previewDoc.file_url && (
                <InlinePdfViewer fileUrl={previewDoc.file_url} fileName={previewDoc.name} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!versionDoc} onOpenChange={() => setVersionDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Version History - {versionDoc?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {versionHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No version history found.</p>}
            {versionHistory.map(v => (
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
                    <InlinePdfViewer fileUrl={v.file_url} fileName={v.name} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Document Dialog */}
      <Dialog open={!!assigningDoc} onOpenChange={() => { setAssigningDoc(null); setAssigningAppId(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Document to Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3">{assigningDoc?.name}</p>
              <Label>Select Application</Label>
              <Select value={assigningAppId} onValueChange={setAssigningAppId}>
                <SelectTrigger><SelectValue placeholder="Choose application…" /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.application_number || 'Draft'} - {a.project_title || 'Untitled'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssigningDoc(null); setAssigningAppId(''); }}>Cancel</Button>
            <Button onClick={handleAssignDoc} disabled={!assigningAppId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Received Document Dialog (Subrecipient) */}
      <Dialog open={!!selectedReceived} onOpenChange={() => { setSelectedReceived(null); setReceivedNotes(''); setSignatureData(null); setShowSignaturePad(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedReceived?.template_name}</DialogTitle></DialogHeader>
          {selectedReceived && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Type: <strong>{selectedReceived.doc_type}</strong></span>
                <span>Application: <strong>{selectedReceived.application_number || ' - '}</strong></span>
                <span>Sent: <strong>{moment(selectedReceived.sent_at).format('MMM D, YYYY')}</strong></span>
                <InboxBadge status={selectedReceived.status} />
              </div>
              {selectedReceived.file_url && (
                <InlinePdfViewer fileUrl={selectedReceived.file_url} fileName={selectedReceived.file_name || selectedReceived.template_name} />
              )}
              {selectedReceived.populated_body && (
                <div>
                  <Label>Document Content</Label>
                  <div className="mt-1 border rounded-lg p-4 bg-white text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {selectedReceived.populated_body}
                  </div>
                </div>
              )}
              {(selectedReceived.status === 'Sent' || selectedReceived.status === 'Reviewed') && (
                <>
                  <div>
                    <Label>Your Notes (optional)</Label>
                    <Textarea className="mt-1" rows={3} value={receivedNotes} onChange={e => setReceivedNotes(e.target.value)} placeholder="Add comments or reasons for rejection…" />
                  </div>
                  {!showSignaturePad && !signatureData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                      By clicking <strong>Sign & Accept</strong>, you electronically acknowledge and accept this document on behalf of your organization.
                    </div>
                  )}
                  {showSignaturePad && (
                    <SignaturePad onSave={(data) => { setSignatureData(data); setShowSignaturePad(false); }} />
                  )}
                  {signatureData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-800">✓ Signature captured</p>
                      <img src={signatureData} alt="Signature" className="h-20 mt-2 rounded" />
                      <Button variant="outline" size="sm" onClick={() => setShowSignaturePad(true)} className="mt-2 text-xs">Redraw Signature</Button>
                    </div>
                  )}
                </>
              )}
              {selectedReceived.subrecipient_notes && (selectedReceived.status === 'Signed' || selectedReceived.status === 'Rejected') && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Your Notes</p>
                  <p className="text-sm mt-1">{selectedReceived.subrecipient_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedReceived(null); setReceivedNotes(''); }}>Close</Button>
            {(selectedReceived?.status === 'Sent' || selectedReceived?.status === 'Reviewed') && (
              <>
                <Button variant="destructive" onClick={() => handleReceivedAction('Rejected')} disabled={acting}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
                {!signatureData
                  ? <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowSignaturePad(true)} disabled={acting}><PenLine className="h-3.5 w-3.5 mr-1" /> Add Signature</Button>
                  : <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleReceivedAction('Signed')} disabled={acting}><PenLine className="h-3.5 w-3.5 mr-1" /> {acting ? 'Signing…' : 'Sign & Accept'}</Button>
                }
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}