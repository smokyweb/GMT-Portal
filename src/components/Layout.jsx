import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, FileText, ClipboardList, DollarSign, BarChart3,
  Shield, FolderOpen, FileSearch,
  ChevronLeft, ChevronRight, LogOut, Building2, Menu, X, LineChart, CalendarDays, Archive, MessageSquare, Flag, Zap, FilePen, ShieldCheck, Globe, ChevronDown, ChevronUp, BadgeDollarSign, Activity, AlertCircle, CheckCircle } from
  'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '../lib/ThemeContext';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { isStateUser, isAdmin, isSubrecipient } from '../lib/helpers';
import { isFederal, isFederalAdmin, getRoleLabel } from '../lib/permissions';

const federalNavGroups = [
  {
    items: [
      { label: 'Federal Overview', icon: Globe, path: '/' },
    ]
  },
  {
    label: 'System-Wide',
    items: [
      { label: 'All Applications', icon: ClipboardList, path: '/applications' },
      { label: 'Funding Requests', icon: DollarSign, path: '/funding-requests' },
      { label: 'Organizations', icon: Building2, path: '/organizations' },
      { label: 'Grant Programs', icon: FileText, path: '/programs' },
      { label: 'NOFOs', icon: FileSearch, path: '/nofos' },
    ]
  },
  {
    label: 'Oversight',
    items: [
      { label: 'Compliance Flags', icon: Shield, path: '/compliance-flags' },
      { label: 'Reports & Compliance', icon: BarChart3, path: '/reports-compliance' },
      { label: 'Analytics', icon: LineChart, path: '/analytics' },
      { label: 'Financials', icon: DollarSign, path: '/financials' },
      { label: 'Audit Log', icon: Archive, path: '/audit-log' },
    ]
  },
  {
    label: 'Administration',
    adminOnly: true,
    collapsible: true,
    items: [
      { label: 'Admin Hub', icon: ShieldCheck, path: '/admin-hub', adminOnly: true },
      { label: 'Workflow Rules', icon: Zap, path: '/workflow', adminOnly: true },
      { label: 'Doc Templates', icon: FilePen, path: '/document-templates', adminOnly: true },
    ]
  },
];

const stateNavGroups = [
{
  items: [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' }]
},
{
  label: 'GRANTS',
  items: [
  { label: 'Applications', icon: ClipboardList, path: '/applications' },
  { label: 'Funding Requests', icon: DollarSign, path: '/funding-requests' },
  { label: 'NOFOs', icon: FileText, path: '/nofos', adminOnly: true },
  { label: 'Grant Timeline', icon: CalendarDays, path: '/grant-timeline' }]
},
{
  label: 'COMPLIANCE',
  items: [
  { label: 'Reports & Compliance', icon: BarChart3, path: '/reports-compliance' },
  { label: 'Compliance Flags', icon: Shield, path: '/compliance-flags' },
  { label: 'Milestones', icon: Flag, path: '/milestones' }]
},
{
  label: 'FINANCIALS',
  items: [
  { label: 'Financial Overview', icon: DollarSign, path: '/financials' },
  { label: 'Budget Amendments', icon: FilePen, path: '/budget-amendments' },
  { label: 'Credits', icon: BadgeDollarSign, path: '/credits' }]
},
{
  label: 'COMMUNICATIONS',
  items: [
  { label: 'Messages', icon: MessageSquare, path: '/messages' },
  { label: 'Documents', icon: Archive, path: '/documents' }]
},
{
  label: 'ADMIN',
  adminOnly: true,
  collapsible: true,
  requiresRole: ['admin', 'isc_admin', 'federal_admin', 'federal_officer'],
  items: [
  { label: 'Admin Hub', icon: ShieldCheck, path: '/admin-hub' },
  { label: 'System Health', icon: Activity, path: '/admin-health' },
  { label: 'User Management', icon: ShieldCheck, path: '/admin' },
  { label: 'Grant Programs', icon: FileText, path: '/grant-programs' },
  { label: 'Notification Rules', icon: AlertCircle, path: '/notification-rules' },
  { label: 'Org Deep Dive', icon: Building2, path: '/org-deep-dive' },
  { label: 'Doc Templates', icon: FilePen, path: '/template-manager' },
  { label: 'Closeout Checklist', icon: CheckCircle, path: '/closeout-checklist' },
  { label: 'Portfolio Summary', icon: Globe, path: '/portfolio-summary', requiresRole: ['isc_admin', 'federal_admin', 'federal_officer'] }]
}];


const subrecipientNavGroups = [
{
  items: [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' }]
},
{
  label: 'My Grants',
  items: [
  { label: 'My Applications', icon: ClipboardList, path: '/my-applications' },
  { label: 'Funding Requests', icon: DollarSign, path: '/my-funding-requests' }]
},
{
  label: 'Tools',
  items: [
  { label: 'Documents', icon: Archive, path: '/documents' },
  { label: 'Budget Tracker', icon: DollarSign, path: '/budget-tracker' },
  { label: 'Messages', icon: MessageSquare, path: '/messages' },
  { label: 'Milestones', icon: Flag, path: '/milestones' }]
},
{
  label: 'Organization',
  items: [
  { label: 'My Organization', icon: Building2, path: '/my-organization' }]
}];


export default function Layout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { grantee } = useTheme();

  const sidebarBg = grantee?.secondary_color || '#0F1F3D';
  const activeBg = grantee?.primary_color || '#2563eb';

  const role = user?.role || 'user';
  const rawGroups = isFederal(role)
    ? federalNavGroups
    : isStateUser(role)
      ? stateNavGroups
      : subrecipientNavGroups;
  const navGroups = rawGroups.
  map((g) => ({ ...g, items: g.items.filter((item) => {
    if (item.adminOnly && !isAdmin(role)) return false;
    if (item.requiresRole && !item.requiresRole.includes(role)) return false;
    return true;
  }) })).
  filter((g) => {
    if (g.adminOnly && !['admin', 'isc_admin', 'federal_admin', 'federal_officer'].includes(role)) return false;
    if (g.requiresRole && !g.requiresRole.includes(role)) return false;
    return g.items.length > 0;
  });

  const handleLogout = () => {
    logout(false); // clears auth state without redirect
    localStorage.removeItem('gmt_token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen &&
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      }

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 text-white flex flex-col transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ backgroundColor: sidebarBg }}>
        
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          {collapsed ?
          <img
            src="https://media.base44.com/images/public/69cd7613124bb9f9f18be5aa/54aa08b4e_Odysseus-Blue_NoTagline.png"
            alt="Odysseus"
            className="h-8 w-8 object-contain flex-shrink-0" /> :


          <img
            src="https://media.base44.com/images/public/69cd7613124bb9f9f18be5aa/54aa08b4e_Odysseus-Blue_NoTagline.png"
            alt="Odysseus GMT Portal"
            className="h-8 object-contain flex-shrink-0 brightness-0 invert" />

          }
          {!collapsed &&
          <div>
              
              <p className="text-white/50 text-xs font-medium">{grantee?.portal_subtitle || 'Grant Management'}</p>
            </div>
          }
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navGroups.map((group, gi) => {
            const isAdminGroup = group.collapsible;
            const groupVisible = !isAdminGroup || adminExpanded;
            return (
              <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                {group.label && !collapsed && (
                isAdminGroup ?
                <button
                  onClick={() => setAdminExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/50 transition">
                  
                      <span>{group.label}</span>
                      {adminExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button> :

                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                      {group.label}
                    </p>)

                }
                {group.label && collapsed &&
                <div className="my-2 mx-3 border-t border-white/10" />
                }
                {(groupVisible || collapsed) && group.items.map((item) => {
                   const active = location.pathname === item.path;
                   return (
                     <Link
                       key={item.path}
                       to={item.path}
                       onClick={() => setMobileOpen(false)}
                       className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${!active ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-white'} ${collapsed ? 'justify-center' : ''}`}
                       style={active ? { backgroundColor: activeBg } : {}}>

                       <item.icon className="h-4 w-4 flex-shrink-0" />
                       {!collapsed && <span>{item.label}</span>}
                     </Link>);

                 })}
              </div>);

          })}

        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/10 space-y-1">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white w-full transition ${collapsed ? 'justify-center' : ''}`}>
            
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-full py-2 text-white/40 hover:text-white/70 transition">
            
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
                {isFederal(role) ? 'Federal Portal' : isStateUser(role) ? 'State Portal' : 'Subrecipient Portal'}
              </p>
              <p className="text-xs text-muted-foreground">
                {getRoleLabel(role)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStateUser(role) && <GlobalSearch />}
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
    </div>);

}