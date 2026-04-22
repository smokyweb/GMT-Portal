import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import MessageThread from '../components/MessageThread';
import { isStateUser } from '../lib/helpers';
import moment from 'moment';

const TOPIC_COLORS = {
  General:       'bg-slate-100 text-slate-700',
  Budget:        'bg-green-100 text-green-700',
  Compliance:    'bg-red-100 text-red-700',
  Documentation: 'bg-blue-100 text-blue-700',
  Timeline:      'bg-purple-100 text-purple-700',
  Other:         'bg-orange-100 text-orange-700',
};

export default function Messages() {
  const [user, setUser] = useState(null);
  const [apps, setApps] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const isState = isStateUser(u?.role);

      let appList, msgList;
      if (isState) {
        [appList, msgList] = await Promise.all([
          base44.entities.Application.list('-created_date', 200),
          base44.entities.Message.list('-created_date', 500),
        ]);
      } else {
        const orgId = u?.organization_id;
        if (!orgId) { setLoading(false); return; }
        [appList, msgList] = await Promise.all([
          base44.entities.Application.filter({ organization_id: orgId }, '-created_date', 50),
          base44.entities.Message.filter({ organization_id: orgId }, '-created_date', 500),
        ]);
      }

      setApps(appList);
      setMessages(msgList);
      if (appList.length > 0) setSelectedApp(appList[0]);
      setLoading(false);
    });
  }, []);

  const reload = async () => {
    const isState = isStateUser(user?.role);
    const msgList = isState
      ? await base44.entities.Message.list('-created_date', 500)
      : await base44.entities.Message.filter({ organization_id: user?.organization_id }, '-created_date', 500);
    setMessages(msgList);
  };

  // Threads = root messages (no thread_id) for an app
  const getRootMessages = (appId) =>
    messages.filter(m => m.application_id === appId && !m.thread_id);

  const getReplies = (threadId) =>
    messages.filter(m => m.thread_id === threadId);

  const getUnreadCount = (appId) => {
    const isState = isStateUser(user?.role);
    return messages.filter(m =>
      m.application_id === appId &&
      (isState ? !m.is_read_by_admin : !m.is_read_by_subrecipient)
    ).length;
  };

  const filteredApps = apps.filter(a =>
    !search ||
    a.application_number?.toLowerCase().includes(search.toLowerCase()) ||
    a.organization_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.project_title?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const isState = isStateUser(user?.role);

  if (!isState && !user?.organization_id) return (
    <div className="text-center py-16 text-muted-foreground">
      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No organization linked to your account.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-xl overflow-hidden bg-card">
      {/* Left panel: Application list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm mb-2">Messages</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search applications…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredApps.length === 0 && (
            <p className="text-xs text-muted-foreground text-center p-6">No applications found.</p>
          )}
          {filteredApps.map(app => {
            const unread = getUnreadCount(app.id);
            const latest = messages
              .filter(m => m.application_id === app.id)
              .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
            const isSelected = selectedApp?.id === app.id;
            return (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full text-left px-3 py-3 border-b transition hover:bg-muted/40
                  ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold font-mono truncate">{app.application_number || 'Draft'}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.organization_name || app.project_title || '—'}</p>
                    {latest && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">{latest.body}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {latest && <span className="text-[10px] text-muted-foreground">{moment(latest.created_date).fromNow()}</span>}
                    {unread > 0 && (
                      <span className="h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel: Thread view */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedApp ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select an application to view messages</p>
            </div>
          </div>
        ) : (
          <MessageThread
            app={selectedApp}
            user={user}
            rootMessages={getRootMessages(selectedApp.id)}
            getReplies={getReplies}
            topicColors={TOPIC_COLORS}
            onMessageSent={reload}
          />
        )}
      </div>
    </div>
  );
}