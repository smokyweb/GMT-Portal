import { DATA_SOURCES, SUBRECIPIENT_SOURCES } from '../../lib/reportDataSources';

const groupOrder = ['GRANTS & PROGRAMS', 'APPLICATIONS', 'FUNDING', 'COMPLIANCE & REPORTING', 'ORGANIZATIONS', 'COMBINED VIEWS'];

export default function DataSourceStep({ value, onChange, isSubrecipient }) {
  const sources = isSubrecipient ? SUBRECIPIENT_SOURCES : DATA_SOURCES;

  // Group sources
  const groups = {};
  Object.entries(sources).forEach(([key, src]) => {
    const g = src.group || 'OTHER';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, ...src });
  });

  const orderedGroups = (isSubrecipient
    ? Object.keys(groups)
    : groupOrder.filter(g => groups[g])
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose the primary data you want to report on.</p>
      {orderedGroups.map(groupName => (
        <div key={groupName}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{groupName}</p>
          <div className="space-y-1">
            {(groups[groupName] || []).map(src => (
              <button
                key={src.key}
                onClick={() => onChange(src.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition
                  ${value === src.key
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-transparent hover:border-border hover:bg-muted/50'
                  }`}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}