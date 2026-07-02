import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SignaturePad from './SignaturePad';
import { ShieldCheck, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { formatDateShort } from '../lib/helpers';

/**
 * CeoSignatureWorkflow
 * Renders the CEO/Authorized Official acknowledgement form + signature capture.
 * Stores the signature image URL and document hash on the Application record.
 *
 * Props: application, user, onSigned
 */
export default function CeoSignatureWorkflow({ application, user, onSigned }) {
  const [signerName, setSignerName] = useState(user?.full_name || '');
  const [signerTitle, setSignerTitle] = useState('');
  const [capturedSig, setCapturedSig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const alreadySigned = !!application?.subaward_signed;

  // Build document content string for hashing
  const documentContent = JSON.stringify({
    application_number: application?.application_number,
    organization_name: application?.organization_name,
    program_code: application?.program_code,
    awarded_amount: application?.awarded_amount || application?.requested_amount,
    performance_start: application?.performance_start,
    performance_end: application?.performance_end,
    grant_number: application?.grant_number,
  });

  const handleSign = async () => {
    if (!capturedSig) { setError('Please capture your signature first.'); return; }
    if (!signerName.trim()) { setError('Signer name is required.'); return; }
    setError('');
    setSaving(true);

    // Upload signature image
    let signatureUrl = '';
    try {
      const blob = await (await fetch(capturedSig.signatureDataUrl)).blob();
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const file_url = await uploadFileToServer(file);
      signatureUrl = file_url;
    } catch (_) {
      signatureUrl = capturedSig.signatureDataUrl; // fallback: store data URL
    }

    await base44.entities.Application.update(application.id, {
      subaward_signed: true,
      subaward_signed_date: capturedSig.signedAt,
      subaward_signed_by: `${signerName} (${signerTitle || 'Authorized Official'})`,
    });

    // Store signature + hash in AuditLog for full traceability
    await base44.entities.AuditLog.create({
      user_email: user?.email,
      user_name: signerName,
      action: 'SubawardSigned',
      entity_type: 'Application',
      entity_id: application.id,
      description: `CEO/Authorized Official e-signature captured. Signer: ${signerName} (${signerTitle}). Document Hash: ${capturedSig.documentHash}. Signature URL: ${signatureUrl}`,
    });

    setSaving(false);
    setDone(true);
    onSigned?.();
  };

  if (alreadySigned || done) {
    return (
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Subaward Agreement Signed</p>
          {application?.subaward_signed_by && (
            <p className="text-xs text-green-700 mt-0.5">Signed by: {application.subaward_signed_by}</p>
          )}
          {application?.subaward_signed_date && (
            <p className="text-xs text-green-700">Date: {formatDateShort(application.subaward_signed_date)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-bold">Chief Elected Official Acknowledgement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            By signing below, the authorized official certifies that the information submitted is accurate and that the
            organization agrees to comply with all federal grant requirements, regulations, and special conditions
            associated with application <span className="font-mono font-semibold">{application?.application_number}</span>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Authorized Official Name <span className="text-red-500">*</span></Label>
          <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Full legal name" />
        </div>
        <div className="space-y-1">
          <Label>Title / Position</Label>
          <Input value={signerTitle} onChange={e => setSignerTitle(e.target.value)} placeholder="e.g. County Executive, Mayor" />
        </div>
      </div>

      <SignaturePad
        onSave={setCapturedSig}
        documentContent={documentContent}
        signerName={signerName}
        label="Authorized Official Signature"
      />

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Button onClick={handleSign} disabled={saving || !capturedSig} className="w-full sm:w-auto">
        <ShieldCheck className="h-4 w-4 mr-2" />
        {saving ? 'Submitting…' : 'Submit Signed Acknowledgement'}
      </Button>
    </div>
  );
}