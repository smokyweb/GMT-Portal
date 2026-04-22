import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SignaturePad from '../components/SignaturePad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle, XCircle, Clock, PenLine, Download } from 'lucide-react';
import moment from 'moment';

const STATUS_CONFIG = {
  Sent:     { label: 'Awaiting Review',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  Reviewed: { label: 'Reviewed',         bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  Signed:   { label: 'Signed',           bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  Rejected: { label: 'Rejected',         bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.Sent;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export default function DocumentsInbox() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (u.organization_id) {
        const d = await base44.entities.GeneratedDocument.filter({ organization_id: u.organization_id }, '-sent_at', 100);
        setDocs(d);
      }
      setLoading(false);
    });
  }, []);

  const handleAction = async (action) => {
    setActing(true);
    const update = {
      status: action,
      subrecipient_notes: notes,
      ...(action === 'Signed' ? { 
        signed_at: new Date().toISOString(), 
        signed_by: user?.email,
        signature_data: signatureData 
      } : {}),
    };
    await base44.entities.GeneratedDocument.update(selected.id, update);
    // Notify state admin
    await base44.entities.Notification.create({
      user_email: selected.sent_by,
      title: `Document ${action}: ${selected.template_name}`,
      message: `${selected.organization_name} has ${action.toLowerCase()} the document "${selected.template_name}".${notes ? ` Notes: ${notes}` : ''}`,
      type: 'document',
      entity_type: 'GeneratedDocument',
      entity_id: selected.id,
      is_read: false,
    });
    setDocs(prev => prev.map(d => d.id === selected.id ? { ...d, ...update } : d));
    setActing(false);
    setSelected(null);
    setNotes('');
    setSignatureData(null);
    setShowSignaturePad(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const pending = docs.filter(d => d.status === 'Sent' || d.status === 'Reviewed');
  const completed = docs.filter(d => d.status === 'Signed' || d.status === 'Rejected');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Documents Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">Documents sent by the state for your review and signature.</p>
      </div>

      {/* Pending */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Pending Action ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No documents pending your review.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pending.map(doc => (
              <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <PenLine className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{doc.template_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.doc_type} · App {doc.application_number || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Sent {moment(doc.sent_at).fromNow()} by {doc.sent_by}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={doc.status} />
                  <Button size="sm" onClick={() => { setSelected(doc); setNotes(doc.subrecipient_notes || ''); }}>
                    Review & Sign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Completed ({completed.length})
          </h2>
          <div className="grid gap-3">
            {completed.map(doc => (
              <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4 opacity-80">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.status === 'Signed' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {doc.status === 'Signed'
                      ? <CheckCircle className="h-5 w-5 text-green-600" />
                      : <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                  <div>
                    <p className="font-semibold">{doc.template_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.doc_type} · App {doc.application_number || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.status === 'Signed' ? `Signed ${moment(doc.signed_at).fromNow()} by ${doc.signed_by}` : `Rejected ${moment(doc.updated_date).fromNow()}`}
                    </p>
                    {doc.subrecipient_notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{doc.subrecipient_notes}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={doc.status} />
                  <Button variant="outline" size="sm" onClick={() => { setSelected(doc); setNotes(doc.subrecipient_notes || ''); }}>
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setNotes(''); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.template_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Type: <strong>{selected.doc_type}</strong></span>
                <span>Application: <strong>{selected.application_number || '—'}</strong></span>
                <span>Sent: <strong>{moment(selected.sent_at).format('MMM D, YYYY')}</strong></span>
                <StatusBadge status={selected.status} />
              </div>

              {selected.file_url && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Download className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-purple-900">Template File Attached</p>
                    <p className="text-xs text-purple-700">{selected.file_name || 'Uploaded document'}</p>
                  </div>
                  <a href={selected.file_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                    <button className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition">Download</button>
                  </a>
                </div>
              )}
              {selected.populated_body && (
                <div>
                  <Label>Document Content</Label>
                  <div className="mt-1 border rounded-lg p-4 bg-white text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {selected.populated_body}
                  </div>
                </div>
              )}

              {(selected.status === 'Sent' || selected.status === 'Reviewed') && (
                <>
                  <div>
                    <Label>Your Notes (optional)</Label>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add any questions, comments, or reasons for rejection…"
                    />
                  </div>

                  {!showSignaturePad && !signatureData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                      By clicking <strong>Sign & Accept</strong>, you are electronically acknowledging and accepting this document on behalf of your organization.
                    </div>
                  )}

                  {showSignaturePad && (
                    <div>
                      <SignaturePad onSave={(data) => {
                        setSignatureData(data);
                        setShowSignaturePad(false);
                      }} />
                    </div>
                  )}

                  {signatureData && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-800 flex items-center gap-1">✓ Signature captured</p>
                      <img src={signatureData} alt="Signature" className="h-20 mt-2 rounded" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSignaturePad(true)}
                        className="mt-2 text-xs"
                      >
                        Redraw Signature
                      </Button>
                    </div>
                  )}
                </>
              )}

              {selected.subrecipient_notes && (selected.status === 'Signed' || selected.status === 'Rejected') && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Your Notes</p>
                  <p className="text-sm mt-1">{selected.subrecipient_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setNotes(''); }}>Close</Button>
            {(selected?.status === 'Sent' || selected?.status === 'Reviewed') && (
              <>
                <Button variant="destructive" onClick={() => handleAction('Rejected')} disabled={acting}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
                {!signatureData ? (
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowSignaturePad(true)} disabled={acting}>
                    <PenLine className="h-3.5 w-3.5 mr-1" /> Add Signature
                  </Button>
                ) : (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('Signed')} disabled={acting}>
                    <PenLine className="h-3.5 w-3.5 mr-1" /> {acting ? 'Signing…' : 'Sign & Accept'}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}