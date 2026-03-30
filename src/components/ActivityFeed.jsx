export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
        <p className="text-sm text-gray-500">No scans recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-1">
        {activity.map((scan) => {
          const color = scan.performance >= 90
            ? 'text-score-good'
            : scan.performance >= 50
            ? 'text-score-average'
            : 'text-score-poor';

          return (
            <div
              key={scan.id}
              className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0"
            >
              <span className="text-[10px] text-gray-600 w-16 shrink-0">
                {formatRelativeTime(scan.scanned_at)}
              </span>
              <span className="text-sm text-gray-300 truncate flex-1">
                {scan.sites?.name || 'Unknown'}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 shrink-0">
                {scan.strategy}
              </span>
              <span className={`text-sm font-bold w-8 text-right shrink-0 ${color}`}>
                {scan.performance}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
