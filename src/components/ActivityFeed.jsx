export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
        <p className="text-sm text-gray-500">No scans recorded yet.</p>
      </div>
    );
  }

  // Group activity by date
  const grouped = groupByDate(activity);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{label}</p>
            <div className="space-y-0.5">
              {items.map((scan) => (
                <ActivityRow key={scan.id} scan={scan} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ scan }) {
  const perfColor = scoreColor(scan.performance);
  const a11yColor = scoreColor(scan.accessibility);
  const bpColor = scoreColor(scan.best_practices);
  const seoColor = scoreColor(scan.seo);

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-800/50 transition-colors">
      {/* Strategy icon */}
      <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center shrink-0">
        {scan.strategy === 'mobile' ? (
          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
          </svg>
        )}
      </div>

      {/* Site name + time */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-300">{scan.sites?.name || 'Unknown'}</span>
        <span className="text-[10px] text-gray-600 ml-2">{formatTime(scan.scanned_at)}</span>
      </div>

      {/* Vitals */}
      {scan.lcp && (
        <span className="text-[10px] text-gray-500 hidden md:block">LCP {scan.lcp}</span>
      )}

      {/* All 4 scores as dots */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ScoreDot value={scan.performance} color={perfColor} label="P" />
        <ScoreDot value={scan.accessibility} color={a11yColor} label="A" />
        <ScoreDot value={scan.best_practices} color={bpColor} label="B" />
        <ScoreDot value={scan.seo} color={seoColor} label="S" />
      </div>
    </div>
  );
}

function ScoreDot({ value, color, label }) {
  return (
    <div className="text-center" title={`${label}: ${value}`}>
      <span className={`text-[10px] font-bold ${color}`}>{value}</span>
    </div>
  );
}

function scoreColor(value) {
  if (value >= 90) return 'text-score-good';
  if (value >= 50) return 'text-score-average';
  return 'text-score-poor';
}

function groupByDate(activity) {
  const groups = new Map();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now - 86400000).toDateString();

  for (const scan of activity) {
    const date = new Date(scan.scanned_at);
    const dateStr = date.toDateString();
    let label;

    if (dateStr === today) label = 'Today';
    else if (dateStr === yesterday) label = 'Yesterday';
    else label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(scan);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
