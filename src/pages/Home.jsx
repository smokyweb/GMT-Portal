import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import StateDashboard from './StateDashboard';
import SubrecipientDashboard from './SubrecipientDashboard';
import { isStateUser } from '../lib/helpers';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAs] = useState(null); // 'state' | 'subrecipient'

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isState = isStateUser(user?.role);
  const showSubrecipient = !isState || viewAs === 'subrecipient';

  return (
    <div>
      {isState && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs text-amber-800 font-medium">Preview as:</span>
          <button
            onClick={() => setViewAs(null)}
            className={`text-xs px-3 py-1 rounded-md font-medium transition ${
              viewAs !== 'subrecipient' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >State Admin</button>
          <button
            onClick={() => setViewAs('subrecipient')}
            className={`text-xs px-3 py-1 rounded-md font-medium transition ${
              viewAs === 'subrecipient' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
            }`}
          >Subrecipient</button>
        </div>
      )}
      {showSubrecipient ? <SubrecipientDashboard /> : <StateDashboard />}
    </div>
  );
}