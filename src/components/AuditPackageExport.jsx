import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PackageOpen, Loader2, Lock } from 'lucide-react';

export default function AuditPackageExport({ application }) {
  const [loading, setLoading] = useState(false);

  const isEligible = ['Approved', 'Closed', 'Archived', 'Denied'].includes(application?.status);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/functions/exportAuditPackage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ application_id: application.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(`Export failed: ${err.error}`);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_package_${application.application_number || application.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isEligible) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      title="Download full audit package as ZIP"
    >
      {loading
        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Exporting…</>
        : <><PackageOpen className="h-3.5 w-3.5 mr-1.5" /> Audit Package</>
      }
    </Button>
  );
}