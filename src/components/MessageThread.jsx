import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Reply, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isStateUser } from '../lib/helpers';
import moment from 'moment';

const TOPICS = ['General', 'Budget', 'Compliance', 'Documentation', 'Timeline', 'Other'];

function MessageBubble({ msg, user, replies, getReplies, onReply, topicColors, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const isOwn = msg.sender_email === user?.email;
  const isState = isStateUser(msg.sender_role);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    const newMsg = await base44.entities.Message.create({
      application_id: msg.application_id,
      application_number: msg.application_number,
      organization_name: msg.organization_name,
      thread_id: msg.thread_id || msg.id,
      parent_id: msg.id,
      sender_email: user.email,
      sender_name: user.full_name,
      sender_role: user.role,
      body: replyText.trim(),
      topic: msg.topic,
      is_read_by_admin: isStateUser(user?.role),
      is_read_by_subrecipient: !isStateUser(user?.role),
    });
    // Email notification
    try {
      await base44.integrations.Core.SendEmail({
        to: isOwn ? msg.application_number : msg.sender_email,
        subject: `New reply on Application ${msg.application_number}`,
        body: `${user.full_name} replied to your message on application ${msg.application_number}:\n\n"${replyText.trim()}"\n\nLog in to the GMT Portal to view and respond.`,
      });
    } catch (_) {}
    setReplyText('');
    setReplyOpen(false);
    setSending(false);
    onReply();
  };

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-muted' : ''}`}>
      <div className={`group rounded-xl p-3 mb-2 ${isOwn ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40 border border-transparent'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0
              ${isState ? 'bg-blue-600' : 'bg-emerald-600'}`}>
              {msg.sender_name?.charAt(0) || '?'}
            </div>
            <span className="text-xs font-semibold">{msg.sender_name || msg.sender_email}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isState ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isState ? 'State' : 'Subrecipient'}
            </span>
            {msg.topic && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${topicColors[msg.topic] || 'bg-slate-100 text-slate-700'}`}>
                <Tag className="h-2.5 w-2.5" />{msg.topic}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{moment(msg.created_date).fromNow()}</span>
        </div>
        <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setReplyOpen(r => !r)}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition"
          >
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
            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className="text-sm"
            />
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
        <MessageBubble
          key={r.id}
          msg={r}
          user={user}
          replies={getReplies(r.thread_id || r.id).filter(x => x.parent_id === r.id)}
          getReplies={getReplies}
          onReply={onReply}
          topicColors={topicColors}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function MessageThread({ app, user, rootMessages, getReplies, topicColors, onMessageSent }) {
  const [newBody, setNewBody] = useState('');
  const [newTopic, setNewTopic] = useState('General');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rootMessages]);

  const handleSend = async () => {
    if (!newBody.trim()) return;
    setSending(true);
    await base44.entities.Message.create({
      application_id: app.id,
      application_number: app.application_number,
      organization_name: app.organization_name,
      thread_id: null,
      parent_id: null,
      sender_email: user.email,
      sender_name: user.full_name,
      sender_role: user.role,
      body: newBody.trim(),
      topic: newTopic,
      is_read_by_admin: isStateUser(user?.role),
      is_read_by_subrecipient: !isStateUser(user?.role),
    });
    // Email notification to other party
    try {
      const recipientEmail = isStateUser(user?.role)
        ? app.submitted_by
        : null; // state admins notified via a generic address or skip
      if (recipientEmail) {
        await base44.integrations.Core.SendEmail({
          to: recipientEmail,
          subject: `New message on Application ${app.application_number} [${newTopic}]`,
          body: `${user.full_name} sent you a message on application ${app.application_number}:\n\n"${newBody.trim()}"\n\nLog in to the GMT Portal to respond.`,
        });
      }
    } catch (_) {}
    setNewBody('');
    setSending(false);
    onMessageSent();
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-sm">{app.application_number || 'Draft'}</p>
            <p className="text-xs text-muted-foreground">{app.organization_name} · {app.program_code} · {app.status}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {rootMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Start a conversation below</p>
          </div>
        )}
        {rootMessages
          .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
          .map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              user={user}
              replies={getReplies(msg.id).filter(r => r.parent_id === msg.id)}
              getReplies={getReplies}
              onReply={onMessageSent}
              topicColors={topicColors}
              depth={0}
            />
          ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t p-3 bg-card flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={newTopic} onValueChange={setNewTopic}>
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            rows={2}
            placeholder={`New message on ${app.application_number || 'this application'}…`}
            className="text-sm resize-none flex-1"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
          />
          <Button onClick={handleSend} disabled={sending || !newBody.trim()} className="self-end">
            <Send className="h-3.5 w-3.5 mr-1" />{sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
      </div>
    </>
  );
}