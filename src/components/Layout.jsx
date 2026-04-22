import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, FileText, ClipboardList, DollarSign, BarChart3,
  Shield, Settings, Users, FolderOpen, FileSearch, Send,
  ChevronLeft, ChevronRight, LogOut, Building2, Menu, X, LineChart, CalendarDays, Archive, MessageSquare, Flag, MapPin, Zap, FilePen, Inbox, ShieldCheck, Globe, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '../lib/ThemeContext';
import NotificationBell from './NotificationBell';
import { isStateUser, isAdmin, isSubrecipient } from '../lib/helpers';

const stateNavGroups = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ]
  },
  {
    label: 'Grant Management',
    items: [
      { label: 'NOFOs', icon: FileText, path: '/nofos', adminOnly: true },
      { label: 'Applications', icon: ClipboardList, path: '/applications' },
      { label: 'Funding Requests', icon: DollarSign, path: '/funding-requests' },
      { label: 'Grant Timeline', icon: CalendarDays, path: '/grant-timeline' },
    ]
  },
  {
    label: 'Compliance',
    items: [
      { label: 'Reports & Compliance', icon: BarChart3, path: '/reports' },
      { label: 'Compliance Flags', icon: Shield, path: '/compliance' },
      { label: 'Milestones', icon: Flag, path: '/milestones' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { label: 'Document Vault', icon: Archive, path: '/documents' },
      { label: 'Reports', icon: BarChart3, path: '/reports-module' },
      { label: 'Messages', icon: MessageSquare, path: '/messages' },
    ]
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { label: 'Analytics', icon: LineChart, path: '/analytics', adminOnly: true },
      { label: 'Financials', icon: DollarSign, path: '/financials', adminOnly: true },
      { label: 'Workflow Rules', icon: Zap, path: '/workflow', adminOnly: true },
      { label: 'Doc Templates', icon: FilePen, path: '/document-templates', adminOnly: true },
      { label: 'Grant Programs', icon: Settings, path: '/programs', adminOnly: true },
      { label: 'Organizations', icon: Building2, path: '/organizations', adminOnly: true },
      { label: 'Audit Log', icon: FileSearch, path: '/audit-log', adminOnly: true },
      { label: 'Admin Panel', icon: ShieldCheck, path: '/admin', adminOnly: true },
      { label: 'ISC Dashboard', icon: Globe, path: '/isc', adminOnly: true },
    ]
  },
];

const subrecipientNavGroups = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'My Portal', icon: LayoutGrid, path: '/subrecipient-portal' },
    ]
  },
  {
    label: 'My Grants',
    items: [
      { label: 'Browse NOFOs', icon: FolderOpen, path: '/browse-nofos' },
      { label: 'My Applications', icon: ClipboardList, path: '/my-applications' },
      { label: 'Funding Requests', icon: DollarSign, path: '/my-funding-requests' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { label: 'Document Vault', icon: Archive, path: '/documents' },
      { label: 'Documents Inbox', icon: Inbox, path: '/documents-inbox' },
      { label: 'Budget Tracker', icon: DollarSign, path: '/budget-tracker' },
      { label: 'My Reports', icon: BarChart3, path: '/reports-module' },
      { label: 'Messages', icon: MessageSquare, path: '/messages' },
      { label: 'Milestones', icon: Flag, path: '/milestones' },
    ]
  },
  {
    label: 'Organization',
    items: [
      { label: 'My Organization', icon: Building2, path: '/my-organization' },
    ]
  },
];

export default function Layout() {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { grantee } = useTheme();

  const sidebarBg = grantee?.secondary_color || '#0F1F3D';
  const activeBg = grantee?.primary_color || '#2563eb';

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const role = user?.role || 'user';
  const rawGroups = isStateUser(role) ? stateNavGroups : subrecipientNavGroups;
  const navGroups = rawGroups
    .map(g => ({ ...g, items: g.items.filter(item => !item.adminOnly || isAdmin(role)) }))
    .filter(g => (!g.adminOnly || isAdmin(role)) && g.items.length > 0);

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 text-white flex flex-col transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ backgroundColor: sidebarBg }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: grantee?.primary_color || '#2563eb' }}>
            {grantee?.logo_url
              ? <img src={grantee.logo_url} alt="logo" className="h-7 w-7 rounded object-contain" />
              : <Shield className="h-4 w-4 text-white" />
            }
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold tracking-wide">{grantee?.portal_title || 'GMT Portal'}</h1>
              <p className="text-[10px] text-white/50">{grantee?.portal_subtitle || 'Grant Management'}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {group.label && !collapsed && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {group.label}
                </p>
              )}
              {group.label && collapsed && (
                <div className="my-2 mx-3 border-t border-white/10" />
              )}
              {group.items.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${!active ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-white'} ${collapsed ? 'justify-center' : ''}`}
                  style={active ? { backgroundColor: activeBg } : {}}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/10 space-y-1">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white w-full transition ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 text-white/40 hover:text-white/70 transition"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold">
                {isStateUser(role) ? 'State Portal' : 'Subrecipient Portal'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin(role) ? 'State Admin' : role === 'reviewer' ? 'State Reviewer' : 'Subrecipient'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userEmail={user?.email} />
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l">
              <a href="/profile" className="flex items-center gap-2 hover:opacity-80 transition">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{user?.full_name?.charAt(0) || 'U'}</span>
                </div>
                <span className="text-sm font-medium">{user?.full_name || 'User'}</span>
              </a>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}