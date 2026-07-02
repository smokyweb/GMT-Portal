import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Paperclip, Loader2, ExternalLink, Upload, CheckCircle, XCircle,
  Clock, FileText, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import moment from 'moment';

const DOC_TYPES = [
  'Invoice', 'PerformanceEvidence', 'Contract', 'BudgetJustification',
  'MatchDocumentation', 'ProgressNarrative', 'FinalReport', 'Other',
];

const STATUS_CONFIG = {
  Pending:  { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: Clock },
  Approved: { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  Rejected: { bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
};

/**
 * FundingRequestDocsViewer
 * Admin-side panel: lists all documents attached to a funding request,
 * lets admins approve/reject each with optional notes, and upload additional files.
 *
 * Props:
 *   fundingRequest - the full FundingRequest object
 *   user - current admin user
 */
export default function FundingRequestDocsViewer({ fundingRequest, user }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('Other');
  const [reviewing, setReviewing] = useState(null); // doc id being reviewed
  const [reviewNotes, setReviewNotes] = useState('');
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    // Primary: fetch by funding_request_id
    const byFR = await base44.entities.Document.filter({ funding_request_id: fundingRequest.id }, '-created_date', 100);
    // Fallback: fetch legacy docs linked via description (migration path)
    const legacyByApp = fundingRequest.application_id
      ? await base44.entities.Document.filter({ application_id: fundingRequest.application_id }, '-created_date', 200)
      : [];
    const legacyFiltered = legacyByApp.filter(d =>
      !d.funding_request_id &&
      (d.description?.includes(fundingRequest.id) || d.description?.includes(fundingRequest.request_number || ''))
    );
    const combined = [...byFR, ...legacyFiltered];
    // dedupe
    const seen = new Set();
    setDocs(combined.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [fundingRequest.id]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const file_url = await uploadFileToServer(file);
      await base44.entities.Document.create({
        name: file.name,
        doc_type: docType,
        file_url,
        uploaded_by: user?.email,
        organization_id: fundingRequest.organization_id,
        application_id: fundingRequest.application_id,
        application_number: fundingRequest.application_number,
        organization_name: fundingRequest.organization_name,
        funding_request_id: fundingRequest.id,
        funding_request_number: fundingRequest.request_number,
        review_status: 'Approved', // admin-uploaded docs are auto-approved
        reviewer_email: user?.email,
        reviewed_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        description: `Admin upload for ${fundingRequest.request_number}`,
      });
    }
    e.target.value = '';
    setUploading(false);
    load();
  };

  const handleReview = async (doc, status) => {
    await base44.entities.Document.update(doc.id, {
      review_status: status,
      reviewer_email: user?.email,
      reviewer_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
    });
    setReviewing(null);
    setReviewNotes('');
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Admin upload controls */}
      <div className="flex flex-wrap items-end gap-3 pb-3 border-b">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs mb-1 block">Document Type</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Uploading…</>
            : <><Upload className="h-3.5 w-3.5 mr-1" /> Add Document</>
          }
        </Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload}
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.docx,.doc" />
      </div>

      {/* Document count summary */}
      {docs.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
          <span className="text-amber-600">{docs.filter(d => d.review_status === 'Pending').length} pending review</span>
          <span className="text-green-600">{docs.filter(d => d.review_status === 'Approved').length} approved</span>
          {docs.filter(d => d.review_status === 'Rejected').length > 0 && (
            <span className="text-red-600">{docs.filter(d => d.review_status === 'Rejected').length} rejected</span>
          )}
        </div>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-28 text-muted-foreground border border-dashed rounded-xl">
          <FileText className="h-6 w-6 mb-2 opacity-30" />
          <p className="text-sm">No documents attached to this request</p>
          <p className="text-xs mt-1">Subrecipients can upload supporting docs from their portal, or you can add files above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const statusCfg = STATUS_CONFIG[doc.review_status] || STATUS_CONFIG.Pending;
            const StatusIcon = statusCfg.icon;
            const isReviewing = reviewing === doc.id;
            return (
              <div key={doc.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.doc_type?.replace(/([A-Z])/g, ' $1').trim()}
                      {doc.uploaded_by && ` · ${doc.uploaded_by}`}
                      {' · '}{moment(doc.uploaded_at || doc.created_date).fromNow()}
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusCfg.bg} ${statusCfg.text}`}>
                    <StatusIcon className="h-3 w-3" />
                    {doc.review_status || 'Pending'}
                  </span>

                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:opacity-70 transition flex-shrink-0" title="Open file">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  {doc.review_status === 'Pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-xs h-7 px-2"
                      onClick={() => { setReviewing(isReviewing ? null : doc.id); setReviewNotes(''); }}
                    >
                      Review <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isReviewing ? 'rotate-180' : ''}`} />
                    </Button>
                  )}
                </div>

                {/* Inline review form */}
                {isReviewing && (
                  <div className="border-t bg-muted/20 p-3 space-y-2">
                    {doc.reviewer_notes && (
                      <p className="text-xs text-muted-foreground italic">Previous note: {doc.reviewer_notes}</p>
                    )}
                    <Textarea
                      rows={2}
                      className="text-xs"
                      placeholder="Optional reviewer notes…"
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => handleReview(doc, 'Rejected')}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleReview(doc, 'Approved')}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show reviewer notes if already reviewed */}
                {doc.review_status !== 'Pending' && doc.reviewer_notes && (
                  <div className="border-t px-3 py-2 bg-muted/10">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Note:</span> {doc.reviewer_notes}
                      {doc.reviewer_email && ` - ${doc.reviewer_email}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}