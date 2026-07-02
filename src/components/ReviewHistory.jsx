import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, CheckCircle, XCircle, RefreshCw, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const ACTION_CONFIG = {
  Approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  Denied: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  RevisionRequested: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50' },
  Note: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  AdditionalInfoRequested: { icon: Info, color: 'text-purple-600', bg: 'bg-purple-50' },
};

export default function ReviewHistory({ entityType, entityId, user, readOnly = false, className = '' }) {
  const [comments, setComments] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    loadComments();
  }, [entityId]);

  const loadComments = async () => {
    try {
      const results = await base44.entities.ReviewComment.filter(
        { entity_type: entityType, entity_id: entityId },
        '-created_date',
        50
      );
      setComments(Array.isArray(results) ? results : []);
    } catch (e) {
      setComments([]);
    }
  };

  const saveNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ReviewComment.create({
        entity_type: entityType,
        entity_id: entityId,
        reviewer_email: user?.email || '',
        reviewer_name: user?.full_name || user?.email || 'Reviewer',
        comment: newNote.trim(),
        action: 'Note',
      });
      setNewNote('');
      await loadComments();
    } catch (e) {
      console.error('Failed to save note:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!entityId) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Review History
        {comments.length > 0 && (
          <span className="text-muted-foreground font-normal">({comments.length})</span>
        )}
      </h4>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No review history yet.</p>
        )}
        {comments.map(c => {
          const cfg = ACTION_CONFIG[c.action] || ACTION_CONFIG.Note;
          const Icon = cfg.icon;
          return (
            <div key={c.id} className={`rounded-lg p-3 border text-sm ${cfg.bg}`}>
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-xs">{c.reviewer_name || c.reviewer_email}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {c.created_date
                        ? formatDistanceToNow(new Date(c.created_date), { addSuffix: true })
                        : ''}
                    </span>
                  </div>
                  {c.action && c.action !== 'Note' && (
                    <span className={`text-xs font-semibold ${cfg.color} mr-2`}>[{c.action}]</span>
                  )}
                  <span className="text-xs text-foreground">{c.comment}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a reviewer note..."
            rows={2}
            className="text-sm"
          />
          <Button size="sm" onClick={saveNote} disabled={saving || !newNote.trim()}>
            {saving ? 'Saving...' : 'Add Note'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">This record is locked - no new notes can be added.</p>
      )}
    </div>
  );
}
