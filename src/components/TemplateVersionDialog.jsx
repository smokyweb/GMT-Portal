import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';
import moment from 'moment';

function DiffView({ oldText = '', newText = '' }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
      <div>
        <p className="text-muted-foreground font-sans font-medium mb-1">Previous Version</p>
        <div className="border rounded-lg bg-red-50 p-3 overflow-auto max-h-64 space-y-0.5">
          {Array.from({ length: maxLen }).map((_, i) => {
            const line = oldLines[i] ?? '';
            const changed = line !== (newLines[i] ?? '');
            return (
              <div key={i} className={`whitespace-pre-wrap leading-5 ${changed ? 'bg-red-200 rounded px-1' : ''}`}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-muted-foreground font-sans font-medium mb-1">Selected Version</p>
        <div className="border rounded-lg bg-green-50 p-3 overflow-auto max-h-64 space-y-0.5">
          {Array.from({ length: maxLen }).map((_, i) => {
            const line = newLines[i] ?? '';
            const changed = line !== (oldLines[i] ?? '');
            return (
              <div key={i} className={`whitespace-pre-wrap leading-5 ${changed ? 'bg-green-200 rounded px-1' : ''}`}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TemplateVersionDialog({ template, onRevert, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (!template) return;
    base44.entities.TemplateVersion.filter({ template_id: template.id }, '-version_number', 50)
      .then(v => { setVersions(v); setLoading(false); });
  }, [template]);

  const handleRevert = async () => {
    if (!selectedVersion) return;
    setReverting(true);
    const data = {
      name: selectedVersion.name,
      doc_type: selectedVersion.doc_type,
      description: selectedVersion.description,
      template_body: selectedVersion.template_body,
      file_url: selectedVersion.file_url || '',
      file_name: selectedVersion.file_name || '',
    };
    await base44.entities.DocumentTemplate.update(template.id, data);
    onRevert({ ...template, ...data });
    setReverting(false);
    onClose();
  };

  if (!template) return null;

  return (
    <Dialog open={!!template} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Version History — {template.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : versions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No version history found. Versions are saved each time you edit a template.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Version list */}
            <div className="border rounded-lg overflow-hidden">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between p-3 cursor-pointer transition border-b last:border-0
                    ${selectedVersion?.id === v.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/40'}`}
                  onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold">v{v.version_number}</span>
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.saved_by} · {moment(v.created_date).format('MMM D, YYYY [at] h:mm A')}
                        {v.change_note && <span className="italic"> — "{v.change_note}"</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {idx === 0 && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">Latest saved</span>}
                    {selectedVersion?.id === v.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected version detail */}
            {selectedVersion && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setComparing(c => !c)}>
                    <GitCompare className="h-3.5 w-3.5 mr-1" />
                    {comparing ? 'Hide Diff' : 'Compare with Current'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRevert} disabled={reverting}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {reverting ? 'Reverting…' : `Revert to v${selectedVersion.version_number}`}
                  </Button>
                </div>

                {comparing ? (
                  <DiffView oldText={template.template_body || ''} newText={selectedVersion.template_body || ''} />
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Template Body (v{selectedVersion.version_number})</p>
                    <div className="border rounded-lg p-3 bg-muted/30 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {selectedVersion.template_body || <span className="italic text-muted-foreground">No body content</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}