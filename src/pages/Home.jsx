import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import StateDashboard from './StateDashboard';
import SubrecipientHome from './SubrecipientHome';
import FederalDashboard from './FederalDashboard';
import GrantAnalyticsPanel from '../components/GrantAnalyticsPanel';
import DashboardFilterBar, { DEFAULT_FILTERS, applyDashboardFilters } from '../components/DashboardFilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isStateUser } from '../lib/helpers';
import { isFederal } from '../lib/permissions';

export default function Home() {
  const [user, setUser] = useState(null);
  const [allApps, setAllApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const isState = isStateUser(u?.role);
      const apps = isState
        ? await base44.entities.Application.list('-created_date', 200)
        : u?.organization_id
          ? await base44.entities.Application.filter({ organization_id: u.organization_id }, '-created_date', 100)
          : [];
      setAllApps(apps);
      setLoading(false);
    });
  }, []);

  const filteredApps = useMemo(() => applyDashboardFilters(allApps, filters), [allApps, filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const role = user?.role;

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