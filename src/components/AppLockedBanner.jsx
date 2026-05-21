import { Lock } from 'lucide-react';

export default function AppLockedBanner({ status }) {
  if (!['Closed', 'Archived'].includes(status)) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-sm font-medium">
      <Lock className="h-4 w-4 shrink-0 text-slate-500" />
      <span>
        This application is <strong>{status}</strong> and is read-only. No changes can be made.
      </span>
    </div>
  );
}