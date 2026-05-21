import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, Loader2, X, ExternalLink, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import moment from 'moment';

const DOC_TYPES = [
  'Invoice',
  'PerformanceEvidence',
  'Contract',
  'BudgetJustification',
  'MatchDocumentation',
  'ProgressNarrative',
  'FinalReport',
  'Other',
];

/**
 * DocumentUploadPanel
 * Props:
 *   applicationId       — required, links documents to the grant record
 *   applicationNumber   — for display / Document entity field
 *   organizationName    — for Document entity field
 *   organizationId      — for Document entity field
 *   user                — current user object
 *   fundingRequestId    — optional, for labeling docs attached to a specific FR
 *   fundingRequestNumber — optional label
 */
export default function DocumentUploadPanel({
  applicationId,
  applicationNumber,
  organizationName,
  organizationId,
  user,
  fundingRequestId,
  fundingRequestNumber,
}) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('Other');
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    if (fundingRequestId) {
      const results = await base44.entities.Document.filter({ funding_request_id: fundingRequestId }, '-created_date', 100);
      setDocs(results);
    } else {
      const results = await base44.entities.Document.filter({ application_id: applicationId }, '-created_date', 100);
      setDocs(results.filter(d => !d.funding_request_id)); // only show app-level docs
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId, fundingRequestId]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        name: file.name,
        doc_type: docType,
        file_url,
        uploaded_by: user?.email,
        organization_id: organizationId,
        application_id: applicationId,
        application_number: applicationNumber,
        organization_name: organizationName,
        review_status: 'Pending',
        uploaded_at: new Date().toISOString(),
        funding_request_id: fundingRequestId || undefined,
        funding_request_number: fundingRequestNumber || undefined,
        description: fundingRequestId
          ? `Attached to funding request ${fundingRequestNumber || fundingRequestId}`
          : `Uploaded via grant record ${applicationNumber || applicationId}`,
      });
    }
    e.target.value = '';
    setUploading(false);
    load();
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Remove "${doc.name}"?`)) return;
    await base44.entities.Document.delete(doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs mb-1 block">Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
            : <><Upload className="h-4 w-4" /> Upload Files</>
          }
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.docx,.doc" />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground border border-dashed rounded-xl">
          <Paperclip className="h-5 w-5 mb-1 opacity-40" />
          <p className="text-sm">No documents attached yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition">
              <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.doc_type?.replace(/([A-Z])/g, ' $1').trim()} · {moment(doc.created_date).fromNow()}
                  {doc.uploaded_by && ` · ${doc.uploaded_by}`}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                doc.review_status === 'Approved' ? 'bg-green-100 text-green-700' :
                doc.review_status === 'Rejected' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {doc.review_status || 'Pending'}
              </span>
              {doc.file_url && (
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-70 transition flex-shrink-0" title="Open file">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button onClick={() => handleDelete(doc)} className="text-muted-foreground hover:text-destructive transition flex-shrink-0" title="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}