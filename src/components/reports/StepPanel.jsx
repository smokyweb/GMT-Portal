import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function StepPanel({ number, title, summary, isComplete, isActive, children, onToggle, open }) {
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${isActive ? 'border-primary/40' : 'border-border'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 p-4 text-left transition ${isActive ? 'bg-primary/5' : 'bg-card hover:bg-muted/40'}`}
      >
        {/* Step number circle */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
          ${isComplete ? 'bg-green-500 text-white' : isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
          {isComplete ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isActive ? 'text-primary' : ''}`}>{title}</p>
          {isComplete && summary && (
            <p className="text-xs text-green-600 mt-0.5 truncate">{summary}</p>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
               : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t p-4 bg-card">
          {children}
        </div>
      )}
    </div>
  );
}