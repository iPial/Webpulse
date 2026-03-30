export default function AuditList({ audits }) {
  if (!audits) return null;

  const { critical = [], improvement = [], optional = [] } = audits;
  const hasAudits = critical.length > 0 || improvement.length > 0 || optional.length > 0;

  if (!hasAudits) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <p className="text-sm text-green-400">All audits passing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {critical.length > 0 && (
        <AuditSection
          title="Fix Immediately"
          color="red"
          audits={critical}
        />
      )}
      {improvement.length > 0 && (
        <AuditSection
          title="Future Improvement"
          color="yellow"
          audits={improvement}
        />
      )}
      {optional.length > 0 && (
        <AuditSection
          title="Optional"
          color="blue"
          audits={optional}
        />
      )}
    </div>
  );
}

function AuditSection({ title, color, audits }) {
  const colors = {
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500', text: 'text-red-400' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-500', text: 'text-yellow-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500', text: 'text-blue-400' },
  };

  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
        <h3 className={`text-sm font-semibold ${c.text}`}>
          {title} ({audits.length})
        </h3>
      </div>
      <div className="space-y-2">
        {audits.map((audit) => (
          <AuditRow key={audit.id} audit={audit} />
        ))}
      </div>
    </div>
  );
}

function AuditRow({ audit }) {
  const scoreColor = audit.score < 50 ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="flex items-start gap-3 py-2 border-t border-white/5 first:border-0 first:pt-0">
      <span className={`text-xs font-mono font-bold mt-0.5 ${scoreColor}`}>
        {audit.score}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200">{audit.title}</p>
        {audit.displayValue && (
          <p className="text-xs text-gray-500 mt-0.5">{audit.displayValue}</p>
        )}
      </div>
    </div>
  );
}
