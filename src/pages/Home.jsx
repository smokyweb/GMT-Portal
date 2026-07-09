import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import StateDashboard from './StateDashboard';
import SubrecipientHome from './SubrecipientHome';
import FederalDashboard from './FederalDashboard';
import ISCDashboard from './ISCDashboard';
import GrantAnalyticsPanel from '../components/GrantAnalyticsPanel';
import DashboardFilterBar, { DEFAULT_FILTERS, applyDashboardFilters } from '../components/DashboardFilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isStateUser } from '../lib/helpers';
import { isFederal, isIscAdmin } from '../lib/permissions';

export default function Home() {
  const { user } = useAuth();
  const [allApps, setAllApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) return;
    const isState = isStateUser(user?.role);
    if (isState) {
      // State admin: load all apps then filter to their scope_state via org membership
      base44.entities.Application.list('-created_date', 500)
        .then(async apps => {
          if (user?.scope_state) {
            const orgs = await base44.entities.Organization.filter({ state: user.scope_state }).catch(() => []);
            const orgIds = new Set((orgs || []).map(o => o.id));
            setAllApps((apps || []).filter(a => orgIds.has(a.organization_id)));
          } else {
            setAllApps(apps || []);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (user?.organization_id) {
      base44.entities.Application.filter({ organization_id: user.organization_id }, '-created_date', 100)
        .then(apps => { setAllApps(apps || []); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const filteredApps = useMemo(() => applyDashboardFilters(allApps, filters), [allApps, filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const role = user?.role;

  if (isIscAdmin(role)) return <ISCDashboard />;
  if (isFederal(role)) return <FederalDashboard />;

  // Subrecipients get the unified portal
  if (!isStateUser(role)) return <SubrecipientHome />;

  // State users get the tabbed state dashboard
  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {activeTab === 'overview' && (
          <div className="mb-4">
            <DashboardFilterBar
              apps={allApps}
              filters={filters}
              setFilters={setFilters}
              isStateView={true}
            />
          </div>
        )}

        <TabsContent value="overview" className="mt-0">
          <StateDashboard filteredApps={filteredApps} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-0">
          <GrantAnalyticsPanel
            organizationId={null}
            filteredAppIds={new Set(filteredApps.map(a => a.id))}
            externalFilters={filters}
            setExternalFilters={setFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}