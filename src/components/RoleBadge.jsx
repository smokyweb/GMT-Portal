import { getRoleLabel, getRoleBadge } from '../lib/permissions';

export default function RoleBadge({ role, size = 'sm' }) {
  const cfg = getRoleBadge(role);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cfg.bg} ${cfg.text} ${sizeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {getRoleLabel(role)}
    </span>
  );
}