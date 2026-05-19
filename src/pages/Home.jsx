import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import StateDashboard from './StateDashboard';
import SubrecipientDashboard from './SubrecipientDashboard';
import { isStateUser } from '../lib/helpers';

export default function Home() {
  // Use the user already loaded by AuthContext — no extra API call needed
  const { user } = useAuth();
  const [viewAs, setViewAs] = useState(null); // 'state' | 'subrecipient'

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