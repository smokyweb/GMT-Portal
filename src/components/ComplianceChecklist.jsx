import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, AlertCircle, Upload, Loader2, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fallback required compliance documents if no NOFO required_documents defined
const REQUIRED_DOCS = [
  { key: 'RiskAssessment',        label: 'Risk Assessment',              mandatory: true  },
  { key: 'WorkPlan',              label: 'Work Plan',                    mandatory: true  },
  { key: 'BudgetJustification',   label: 'Budget Justification',         mandatory: true  },
  { key: 'Contract',              label: 'Signed Subrecipient Agreement', mandatory: true  },
  { key: 'MatchDocumentation',    label: 'Match / Cost-Share Documentation', mandatory: true },
  { key: 'PerformanceEvidence',   label: 'Proof of Insurance',           mandatory: false },
  { key: 'ProgressNarrative',     label: 'Initial Progress Narrative',   mandatory: false },
  { key: 'Other',                 label: 'Other Supporting Documents',   mandatory: false },
];

function DocRow({ item, uploaded, canUpload, applicationId, applicationNumber, organizationName, user, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  // Match by name (NOFO docs) or by doc_type (fallback hardcoded docs)
  const matchingDocs = item.matchByName
    ? uploaded.filter(d => d.name === item.key || d.doc_type === item.key)
    : uploaded.filter(d => d.doc_type === item.key);
  const fulfilled = matchingDocs.length > 0;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('gmt_token');
      let file_url = '';
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) { const data = await res.json(); file_url = data.url || ''; }
      } catch (uploadErr) { console.warn('Upload failed:', uploadErr.message); }
      await base44.entities.Document.create({
        // For NOFO docs: use the required doc name; for type-based: use file name
        name: item.matchByName ? item.label : file.name,
        doc_type: item.matchByName ? 'Other' : item.key,
        file_url,
        uploaded_by: user?.email,
        application_id: applicationId,
        application_number: applicationNumber,
        organization_name: organizationName,
        organization_id: user?.organization_id,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
      });
      onRefresh();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      fulfilled ? 'border-green-200 bg-green-50' :
      item.mandatory ? 'border-amber-200 bg-amber-50' :
      'border-border bg-muted/20'
    }`}>
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {fulfilled
          ? <CheckCircle2 className="h-5 w-5 text-green-600" />
          : item.mandatory
            ? <AlertCircle className="h-5 w-5 text-amber-500" />
            : <Circle className="h-5 w-5 text-muted-foreground" />}
      </div>

      {/* Label + uploaded files */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${fulfilled ? 'text-green-800' : item.mandatory ? 'text-amber-800' : 'text-foreground'}`}>
            {item.label}
          </span>
          {item.mandatory && !fulfilled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">Required</span>
          )}
          {!item.mandatory && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wide">Optional</span>
          )}
        </div>
        {matchingDocs.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {matchingDocs.map(doc => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 hover:underline"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="truncate max-w-[260px]">{doc.name}</span>
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      {canUpload && (
        <div className="flex-shrink-0">
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Upload className="h-3 w-3" />}
            {uploading ? 'Uploading…' : fulfilled ? 'Replace' : 'Upload'}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * ComplianceChecklist
 *
 * Props:
 *   applicationId - Application entity id
 *   applicationNumber - e.g. "APP-2025-00001"
 *   organizationName - org display name
 *   user - current user object
 *   canUpload - bool: whether this user can upload docs (subrecipients = true, reviewers = false or true)
 */
export default function ComplianceChecklist({ applicationId, applicationNumber, organizationName, user, canUpload = false, nofo: nofoProp }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedNofo, setLoadedNofo] = useState(null);

  const nofo = nofoProp || loadedNofo;

  const load = async () => {
    const [d, apps] = await Promise.all([
      base44.entities.Document.filter({ application_id: applicationId }).catch(() => []),
      // Also load the app to get nofo_id if nofo not passed
      !nofoProp ? base44.entities.Application.filter({ id: applicationId }).catch(() => []) : Promise.resolve([]),
    ]);
    setDocs(Array.isArray(d) ? d : []);
    // Load NOFO if not provided
    if (!nofoProp && apps?.[0]?.nofo_id) {
      const allNofos = await base44.entities.Nofo.list('-created_date', 200).catch(() => []);
      const found = (Array.isArray(allNofos) ? allNofos : []).find(n => n.id === apps[0].nofo_id);
      if (found) setLoadedNofo(found);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId, nofoProp]);

  // Build the effective required doc list:
  // If NOFO has required_documents, use those (matching by doc name or doc_type)
  // Otherwise fall back to hardcoded REQUIRED_DOCS
  const rawNofoReqs = nofo?.required_documents || [];
  const nofoRequiredDocs = Array.isArray(rawNofoReqs)
    ? rawNofoReqs
    : (rawNofoReqs && typeof rawNofoReqs === 'object' && rawNofoReqs.name ? [rawNofoReqs] : []);

  const effectiveDocs = nofoRequiredDocs.length > 0
    ? nofoRequiredDocs.map(r => ({
        key: r.name,       // use name as key for NOFO docs
        label: r.name,
        mandatory: r.mandatory !== false,
        matchByName: true, // flag to match by doc name not doc_type
      }))
    : REQUIRED_DOCS;

  // Match uploaded docs: NOFO docs match by name, fallback docs match by doc_type
  const isDocFulfilled = (item) => {
    if (item.matchByName) {
      return docs.some(d => d.name === item.key || d.doc_type === item.key);
    }
    return docs.some(d => d.doc_type === item.key);
  };

  const mandatory  = effectiveDocs.filter(r => r.mandatory);
  const mandatoryMet = mandatory.filter(r => isDocFulfilled(r)).length;
  const pct = mandatory.length ? Math.round((mandatoryMet / mandatory.length) * 100) : 100;

  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="rounded-xl border p-4 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Compliance Document Checklist</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mandatoryMet} of {mandatory.length} required documents uploaded
            </p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            pct === 100 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && (
          <p className="text-xs text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All required compliance documents have been submitted.
          </p>
        )}
      </div>

      {/* Document rows - uses NOFO required docs when available, falls back to hardcoded list */}
      <div className="space-y-2">
        {effectiveDocs.map(item => (
          <DocRow
            key={item.key}
            item={item}
            uploaded={docs}
            canUpload={canUpload}
            applicationId={applicationId}
            applicationNumber={applicationNumber}
            organizationName={organizationName}
            user={user}
            onRefresh={load}
          />
        ))}
      </div>

      {/* Show all uploaded docs not in required list */}
      {docs.filter(d => !effectiveDocs.find(r => isDocFulfilled(r) && (d.name === r.key || d.doc_type === r.key))).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-2">Additional Documents</p>
          {docs.filter(d => !effectiveDocs.find(r => r.matchByName ? d.name === r.key : d.doc_type === r.key)).map(d => (
            <div key={d.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate">{d.name}</span>
              {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}