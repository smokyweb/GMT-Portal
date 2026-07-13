import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  FileSearch, Settings, Building2, Globe, ShieldCheck, FileText,
  ChevronRight, Loader2,
} from 'lucide-react';

const HUB_LINKS = [
  {
    label: 'System Health Dashboard',
    description: 'Real-time system status and critical metrics.',
    icon: ShieldCheck,
    path: '/admin-health',
    color: 'bg-red-50 text-red-600',
    tier: 1,
  },
  {
    label: 'User Management',
    description: 'Manage users, roles, and permissions.',
    icon: ShieldCheck,
    path: '/admin',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    label: 'Applications',
    description: 'Manage applications and document review settings.',
    icon: FileText,
    path: '/admin-applications',
    color: 'bg-green-50 text-green-600',
  },
  {
    label: 'Grant Programs',
    description: 'Configure and manage FEMA grant programs, funding cycles, and requirements.',
    icon: Settings,
    path: '/grant-programs',
    color: 'bg-blue-50 text-blue-600',
    tier: 1,
  },
  {
    label: 'Notification Rules',
    description: 'Configure alert rules and recipient roles.',
    icon: Settings,
    path: '/notification-rules',
    color: 'bg-teal-50 text-teal-600',
    tier: 1,
  },
  {
    label: 'Organizations',
    description: 'View and manage subrecipient organization records.',
    icon: Building2,
    path: '/organizations',
    color: 'bg-green-50 text-green-600',
  },
  {
    label: 'Organization Deep Dive',
    description: '360° view of organization details and records.',
    icon: Building2,
    path: '/org-deep-dive',
    color: 'bg-emerald-50 text-emerald-600',
    tier: 2,
  },
  {
    label: 'Document Templates',
    description: 'Create, manage, and version control templates.',
    icon: FileSearch,
    path: '/template-manager',
    color: 'bg-violet-50 text-violet-600',
    tier: 2,
  },
  // Email Settings moved to ISC Dashboard
  {
    label: 'Audit Log',
    description: 'Full history of all user actions across the platform.',
    icon: FileSearch,
    path: '/audit-log',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'Portfolio Summary',
    description: 'Multi-state funding overview and performance metrics.',
    icon: Globe,
    path: '/portfolio-summary',
    color: 'bg-indigo-50 text-indigo-600',
    tier: 3,
  },
  {
    label: 'ISC Dashboard',
    description: 'Interstate & inter-agency coordination overview.',
    icon: Globe,
    path: '/isc',
    color: 'bg-slate-50 text-slate-600',
  },
];

export default function AdminHub() {
   const [user, setUser] = useState(null);
   const [counts, setCounts] = useState({});
   const [loadingCounts, setLoadingCounts] = useState(true);

   useEffect(() => {
     base44.auth.me().then(async (u) => {
       setUser(u);
       try {
         const [allOrgs, allApps, auditLogs, programs, grantees] = await Promise.all([
           base44.entities.Organization.list(),
           base44.entities.Application.list(),
           base44.entities.AuditLog.list('-created_date', 1000),
           base44.entities.GrantProgram.list(),
           base44.entities.Grantee.list(),
         ]);
         // Scope counts to state admin's scope_state
         let scopedOrgs = allOrgs;
         let scopedApps = allApps;
         if (u?.scope_state && ['admin','reviewer'].includes(u.role)) {
           scopedOrgs = allOrgs.filter(o => o.state === u.scope_state);
           const orgIds = new Set(scopedOrgs.map(o => o.id));
           scopedApps = allApps.filter(a => orgIds.has(a.organization_id));
         }
         const users = await base44.entities.User.list();
         setCounts({
           users: users.length,
           orgs: scopedOrgs.length,
           applications: scopedApps.length,
           auditLogs: auditLogs.length,
           programs: programs.length,
           grantees: grantees.length,
         });
       } catch(e) {
         setCounts({ users: 0, orgs: 0, applications: 0, auditLogs: 0, programs: 0, grantees: 0 });
       }
       setLoadingCounts(false);
     });
   }, []);

  const countLabels = {
    'User Management': `${counts.users || 0} users`,
    'Applications': `${counts.applications || 0} apps`,
    'Grant Programs': `${counts.programs || 0} programs`,
    'Organizations': `${counts.orgs || 0} orgs`,
    'Audit Log': `${counts.auditLogs || 0} entries`,
    'ISC Dashboard': `${counts.grantees || 0} grantees`,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Central access to administrative tools, federal integrations, and system configuration.
        </p>
      </div>

      {/* Navigation links */}
      <div className="grid gap-3">
        {HUB_LINKS.filter(link => {
          if (link.label === 'ISC Dashboard' || link.label === 'Portfolio Summary') {
            return ['isc_admin', 'federal_admin', 'federal_officer'].includes(user?.role);
          }
          return true;
        }).map(({ label, description, icon: Icon, path, color }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-4 bg-card border rounded-xl px-5 py-4 hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {loadingCounts ? (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              ) : (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {countLabels[label] || ' - '}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
            </div>
          </Link>
        ))}
      </div>


    </div>
  );
}