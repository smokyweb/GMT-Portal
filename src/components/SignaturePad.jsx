import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

// Generates a SHA-256 hex hash of the given string using the Web Crypto API
async function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SignaturePad
 *
 * Props:
 *  - onSave(result): called with { signatureDataUrl, documentHash, signedAt, signerName }
 *  - documentContent: string — the document text/JSON to hash at signing time
 *  - signerName: string — display name of the person signing
 *  - label: string — optional label override
 *  - disabled: bool
 */
export default function SignaturePad({ onSave, documentContent = '', signerName = '', label, disabled = false }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hash, setHash] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
    setSaved(false);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    setSaved(false);
    setHash(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const signatureDataUrl = canvasRef.current.toDataURL('image/png');
    const signedAt = new Date().toISOString();
    // Hash the document content + signer + timestamp for tamper-evidence
    const contentToHash = JSON.stringify({ documentContent, signerName, signedAt });
    const documentHash = await sha256(contentToHash);
    setHash(documentHash);
    setSaved(true);
    setSaving(false);
    onSave?.({ signatureDataUrl, documentHash, signedAt, signerName });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">
          {label || 'Chief Elected Official Signature'}
        </label>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" /> Signature Captured
          </span>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`border-2 rounded-lg w-full bg-slate-50 transition ${
            disabled
              ? 'opacity-50 cursor-not-allowed border-slate-200'
              : 'cursor-crosshair border-dashed border-slate-300 hover:border-primary/50'
          } ${saved ? 'border-green-300 bg-green-50/30' : ''}`}
        />
        {isEmpty && !disabled && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none select-none">
            Sign here
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={clear} disabled={isEmpty || disabled}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isEmpty || saving || disabled} className="ml-auto">
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          {saving ? 'Capturing…' : 'Capture & Certify'}
        </Button>
      </div>

      {hash && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 font-mono break-all border">
          <span className="font-semibold text-foreground">Document Hash (SHA-256):</span> {hash}
        </div>
      )}

      {saved && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
          <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
          <p>
            Signature and cryptographic document hash recorded at {new Date().toLocaleString()}.
            {signerName && ` Signed by: ${signerName}.`}
          </p>
        </div>
      )}
    </div>
  );
}