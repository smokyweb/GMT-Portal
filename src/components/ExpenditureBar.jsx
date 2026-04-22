export default function ExpenditureBar({ rate, className = '' }) {
  const pct = Math.min(100, Math.max(0, rate || 0));
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}