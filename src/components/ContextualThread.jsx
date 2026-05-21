import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Reply, ChevronDown, ChevronUp, MessageSquare, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isStateUser } from '../lib/helpers';
import moment from 'moment';

const TOPICS = ['General', 'Budget', 'Compliance', 'Documentation', 'Timeline', 'Other'];

const TOPIC_COLORS = {
  General:       'bg-slate-100 text-slate-700',
  Budget:        'bg-green-100 text-green-700',
  Compliance:    'bg-red-100 text-red-700',
  Documentation: 'bg-blue-100 text-blue-700',
  Timeline:      'bg-amber-100 text-amber-700',
  Other:         'bg-purple-100 text-purple-700',
};

function Bubble({ msg, user, allMessages, onRefresh, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const isOwn  = msg.sender_email === user?.email;
  const isState = isStateUser(msg.sender_role);
  const replies = allMessages.filter(m => m.parent_id === msg.id);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    await base44.entities.Message.create({
      application_id:     msg.application_id,
      application_number: msg.application_number,
      organization_name:  msg.organization_name,
      thread_id:          msg.thread_id || msg.id,
      parent_id:          msg.id,
      sender_email:       user.email,
      sender_name:        user.full_name,
      sender_role:        user.role,
      body:               replyText.trim(),
      topic:              msg.topic,
      is_read_by_admin:         isStateUser(user?.role),
      is_read_by_subrecipient:  !isStateUser(user?.role),
    });
    try {
      if (!isOwn) {
        await base44.integrations.Core.SendEmail({
          to: msg.sender_email,
          subject: `New reply on ${msg.application_number}`,
          body: `${user.full_name} replied:\n\n"${replyText.trim()}"\n\nLog in to the GMT Portal to view.`,
        });
      }
    } catch (_) {}
    setReplyText('');
    setReplyOpen(false);
    setSending(false);
    onRefresh();
  };

  return (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l-2 border-muted' : ''}>
      <div className={`rounded-xl p-3 mb-2 ${isOwn ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40 border border-transparent'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${isState ? 'bg-blue-600' : 'bg-emerald-600'}`}>
              {msg.sender_name?.charAt(0) || '?'}
            </div>
            <span className="text-xs font-semibold">{msg.sender_name || msg.sender_email}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isState ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isState ? 'State' : 'Subrecipient'}
            </span>
            {msg.topic && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${TOPIC_COLORS[msg.topic] || 'bg-slate-100 text-slate-700'}`}>
                <Tag className="h-2.5 w-2.5" />{msg.topic}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{moment(msg.created_date).fromNow()}</span>
        </div>
        <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => setReplyOpen(r => !r)} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition">
            <Reply className="h-3 w-3" /> Reply
          </button>
          {replies.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
        {replyOpen && (
          <div className="mt-2 space-y-2">
            <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} placeholder="Write a reply…" className="text-sm" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setReplyOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleReply} disabled={sending || !replyText.trim()}>
                <Send className="h-3 w-3 mr-1" />{sending ? 'Sending…' : 'Send Reply'}
              </Button>
            </div>
          </div>
        )}
      </div>
      {expanded && replies.map(r => (
        <Bubble key={r.id} msg={r} user={user} allMessages={allMessages} onRefresh={onRefresh} depth={depth + 1} />
      ))}
    </div>
  );
}

/**
 * ContextualThread — embeddable chat thread for any application or funding request.
 *
 * Props:
 *   applicationId        — the Application entity id
 *   applicationNumber    — e.g. "APP-2025-00001"
 *   organizationName     — org display name
 *   programCode          — e.g. "SHSP"
 *   user                 — current user object
 *   contextLabel         — optional label shown in the header (default: applicationNumber)
 */
export default function ContextualThread({
  applicationId,
  applicationNumber,
  organizationName,
  programCode,
  user,
  contextLabel,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [body, setBody]         = useState('');
  const [topic, setTopic]       = useState('General');
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef();

  const load = async () => {
    const msgs = await base44.entities.Message.filter({ application_id: applicationId }, 'created_date', 200);
    setMessages(msgs);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  useEffect(() => { load(); }, [applicationId]);

  const rootMessages = messages.filter(m => !m.parent_id);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    await base44.entities.Message.create({
      application_id:    applicationId,
      application_number: applicationNumber,
      organization_name:  organizationName,
      thread_id:   null,
      parent_id:   null,
      sender_email: user.email,
      sender_name:  user.full_name,
      sender_role:  user.role,
      body:         body.trim(),
      topic,
      is_read_by_admin:        isStateUser(user?.role),
      is_read_by_subrecipient: !isStateUser(user?.role),
    });
    // Email subrecipient when state sends a message
    try {
      if (isStateUser(user?.role)) {
        const apps = await base44.entities.Application.filter({ id: applicationId });
        const recipient = apps[0]?.submitted_by;
        if (recipient) {
          await base44.integrations.Core.SendEmail({
            to: recipient,
            subject: `New message on ${applicationNumber} [${topic}]`,
            body: `${user.full_name} (State Reviewer) sent a message on ${applicationNumber}:\n\n"${body.trim()}"\n\nLog in to the GMT Portal to respond.`,
          });
        }
      }
    } catch (_) {}
    setBody('');
    setSending(false);
    load();
  };

  return (
    <div className="flex flex-col border rounded-xl overflow-hidden bg-card" style={{ minHeight: 320, maxHeight: 480 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">{contextLabel || applicationNumber}</p>
          <p className="text-xs text-muted-foreground">{organizationName}{programCode ? ` · ${programCode}` : ''} · {messages.length} message{messages.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
        {!loading && rootMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageSquare className="h-6 w-6 mb-2 opacity-30" />
            <p className="text-sm">No messages yet — start the conversation below.</p>
          </div>
        )}
        {rootMessages
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
          .map(msg => (
            <Bubble key={msg.id} msg={msg} user={user} allMessages={messages} onRefresh={load} depth={0} />
          ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t p-3 bg-card flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={2}
            placeholder="Type a message…"
            className="text-sm resize-none flex-1"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
          />
          <Button onClick={handleSend} disabled={sending || !body.trim()} className="self-end">
            <Send className="h-3.5 w-3.5 mr-1" />{sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
      </div>
    </div>
  );
}