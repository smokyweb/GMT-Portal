import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, ExternalLink, Calendar, User, Tag, FileText, Building2 } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import { formatDateShort } from '../lib/helpers';

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="flex items-center gap-2 w-36 flex-shrink-0 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-sm flex-1">{children}</div>
    </div>
  );
}

export default function ComplianceFlagDetail({ flag, appMap, onClose, onResolve }) {
  const [notes, setNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  if (!flag) return null;

  const handleResolve = async () => {
    setResolving(true);
    await onResolve(flag, notes);
    setResolving(false);
    onClose();
  };

  return (
    <Dialog open={!!flag} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SeverityBadge severity={flag.severity} />
            <span className="text-base">Compliance Flag Detail</span>
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y border rounded-lg px-4 bg-muted/20">
          <DetailRow icon={Tag} label="Flag Type">
            {flag.flag_type?.replace(/([A-Z])/g, ' $1').trim()}
          </DetailRow>

          <DetailRow icon={FileText} label="Description">
            <span className="leading-relaxed">{flag.description || ' - '}</span>
          </DetailRow>

          <DetailRow icon={Building2} label="Organization">
            {flag.organization_name ? (
              <Link to="/organizations" onClick={onClose} className="text-primary hover:underline inline-flex items-center gap-1">
                {flag.organization_name} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : ' - '}
          </DetailRow>

          <DetailRow icon={FileText} label="Application #">
            {flag.application_number ? (
              <Link
                to={`/applications${appMap[flag.application_number] ? `?review=${appMap[flag.application_number]}` : ''}`}
                onClick={onClose}
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {flag.application_number} <ExternalLink className="h-3 w-3" />
              </Link>
            ) : ' - '}
          </DetailRow>

          <DetailRow icon={Calendar} label="Created">
            {formatDateShort(flag.created_date) || ' - '}
          </DetailRow>

          {flag.is_resolved && (
            <>
              <DetailRow icon={User} label="Resolved By">
                {flag.resolved_by || ' - '}
              </DetailRow>
              <DetailRow icon={Calendar} label="Resolved On">
                {formatDateShort(flag.resolved_at) || ' - '}
              </DetailRow>
              {flag.resolution_notes && (
                <DetailRow icon={FileText} label="Resolution Notes">
                  <span className="leading-relaxed">{flag.resolution_notes}</span>
                </DetailRow>
              )}
            </>
          )}
        </div>

        {!flag.is_resolved && (
          <div className="space-y-2">
            <Label>Resolution Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              rows={3}
              placeholder="Describe the resolution steps or add context…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        )}

        {flag.is_resolved && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">This flag has been resolved.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!flag.is_resolved && (
            <Button onClick={handleResolve} disabled={resolving}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {resolving ? 'Resolving…' : 'Mark Resolved'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}