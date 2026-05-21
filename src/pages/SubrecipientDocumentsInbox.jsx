import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, PenLine, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDateShort } from '../lib/helpers';
import CeoSignatureWorkflow from '../components/CeoSignatureWorkflow';

const STATUS_CONFIG = {
  'Pending Signature': { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 text-amber-700', label: 'Pending Signature' },
  'Sent':             { icon: Clock, color: 'text-blue-600',  bg: 'bg-blue-50 text-blue-700',   label: 'Sent' },
  'Signed':           { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 text-green-700', label: 'Signed' },
  'Reviewed':         { icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50 text-purple-700', label: 'Reviewed' },
  'Rejected':         { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 text-red-700', label: 'Rejected' },
};

export default function SubrecipientDocumentsInbox() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [applications, setApplications] = useState({});
  const [loading, setLoading] = useState(true);
  const [signingDoc, setSigningDoc] = useState(null);
  const [signingApp, setSigningApp] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);

    // Find user's organization via their applications
    const userApps = await base44.entities.Application.filter({ submitted_by: u.email }, '-created_date', 200);
    const orgId = userApps[0]?.organization_id;

    let docs = [];
    if (orgId) {
      docs = await base44.entities.GeneratedDocument.filter({ organization_id: orgId }, '-sent_at', 100);
    }

    // Build app lookup map for signature workflow
    const appMap = {};
    for (const app of userApps) {
      appMap[app.id] = app;
    }

    setDocuments(docs);
    setApplications(appMap);
    setLoading(false);
  };

  const openSignDialog = (doc) => {
    const app = applications[doc.application_id];
    setSigningDoc(doc);
    setSigningApp(app || null);
  };

  const handleSigned = async () => {
    // Update GeneratedDocument status to Signed
    await base44.entities.GeneratedDocument.update(signingDoc.id, {
      status: 'Signed',
      signed_at: new Date().toISOString(),
      signed_by: user?.email,
    });

    // Resolve any related task
    const tasks = await base44.entities.Task.filter({
      application_id: signingDoc.application_id,
      assigned_to: user?.email,
      title: 'Review and Sign Grant Award Notice',
    });
    for (const task of tasks) {
      if (!['Resolved', 'Cancelled'].includes(task.status)) {
        await base44.entities.Task.update(task.id, {
          status: 'Resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.email,
          resolution_notes: 'GAN signed electronically by authorized official.',
        });
      }
    }

    setSigningDoc(null);
    setSigningApp(null);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Documents Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and sign documents sent to your organization by the state.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed rounded-xl p-14 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Documents sent to your organization will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map(doc => {
            const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG['Sent'];
            const StatusIcon = statusCfg.icon;
            const isPendingSignature = doc.status === 'Pending Signature' || doc.status === 'Sent';

            return (
              <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{doc.template_name || doc.doc_type}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Application: <span className="font-mono">{doc.application_number || '—'}</span>
                      {doc.doc_type && ` · ${doc.doc_type}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sent {formatDateShort(doc.sent_at)}
                      {doc.signed_at && ` · Signed ${formatDateShort(doc.signed_at)}`}
                    </p>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" /> {doc.file_name || 'View attached file'}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isPendingSignature ? (
                    <Button size="sm" onClick={() => openSignDialog(doc)}>
                      <PenLine className="h-3.5 w-3.5 mr-1.5" /> Review & Sign
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2">
                      {doc.status === 'Signed' ? `Signed by ${doc.signed_by || '—'}` : doc.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review & Sign Modal */}
      <Dialog open={!!signingDoc} onOpenChange={() => { setSigningDoc(null); setSigningApp(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Review & Sign: {signingDoc?.template_name || signingDoc?.doc_type}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Document body preview */}
            {signingDoc?.populated_body && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Document Content</p>
                <div className="border rounded-lg p-4 bg-white text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono">
                  {signingDoc.populated_body}
                </div>
              </div>
            )}

            {/* File attachment link */}
            {signingDoc?.file_url && (
              <a
                href={signingDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline border rounded-lg px-3 py-2"
              >
                <ExternalLink className="h-4 w-4" /> Open attached document — {signingDoc.file_name || 'View file'}
              </a>
            )}

            {/* E-signature workflow */}
            {signingApp ? (
              <CeoSignatureWorkflow
                application={signingApp}
                user={user}
                onSigned={handleSigned}
              />
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                Application data not found. Please contact your program manager.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}