import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Returns document review settings from AppSettings.
 * { globalEnabled, docTypeSettings, isReviewRequired(docType), loading }
 */
export function useDocumentReviewSettings() {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [docTypeSettings, setDocTypeSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AppSettings.filter({ key: 'document_review' }).then(records => {
      if (records.length > 0) {
        const val = records[0].value || {};
        setGlobalEnabled(val.global_enabled ?? false);
        setDocTypeSettings(val.doc_types ?? {});
      }
      setLoading(false);
    });
  }, []);

  const isReviewRequired = (docType) => {
    if (!globalEnabled) return false;
    return !!docTypeSettings[docType];
  };

  return { globalEnabled, docTypeSettings, isReviewRequired, loading };
}