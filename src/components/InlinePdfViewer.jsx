import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InlinePdfViewer({ fileUrl, fileName }) {
  const [expanded, setExpanded] = useState(false);

  if (!fileUrl) return null;

  const isPdf = fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(fileUrl);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{fileName || 'Document'}</span>
        </div>
        <div className="flex items-center gap-1">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <ExternalLink className="h-3 w-3" /> Open
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide' : 'Preview'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="w-full bg-slate-100">
          {isImage ? (
            <img src={fileUrl} alt={fileName || 'Document'} className="max-w-full max-h-[500px] object-contain mx-auto block p-2" />
          ) : (
            <iframe
              src={fileUrl}
              title={fileName || 'Document Preview'}
              className="w-full h-[500px] border-0"
              allow="fullscreen"
            />
          )}
        </div>
      )}
    </div>
  );
}