import Card from '@/components/ui/Card';

export default function ActivityFeed({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <Card>
        <h3 className="font-semibold text-[15px] text-ink">Recent activity</h3>
        <p className="text-[13px] text-muted mt-2">No scans recorded yet.</p>
      </Card>
    );
  }

  const grouped = groupByDate(activity);

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-[15px] text-ink">Recent activity</h3>
          <p className="text-[12px] text-muted mt-0.5">
            Every scan across every site, grouped by day
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[11px] text-muted uppercase tracking-[0.12em] mb-2 font-semibold">
              {label}
            </p>
            <div className="flex flex-col gap-[2px]">
              {items.map((scan) => (
                <ActivityRow key={scan.id} scan={scan} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityRow({ scan }) {
  return (
    <div className="grid grid-cols-[64px_1fr_140px] md:grid-cols-[80px_1fr_auto_140px] items-center gap-2 md:gap-3 py-[10px] px-[10px] rounded-[12px] hover:bg-paper-2/60 transition-colors">
      <span className="font-mono text-[11px] text-muted">{formatTime(scan.scanned_at)}</span>

      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-[6px] bg-paper-2 shrink-0"
          title={scan.strategy}
        >
          {scan.strategy === 'mobile' ? (
            <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
            </svg>
          )}
        </span>
        <span className="text-[13px] text-ink truncate">
          {scan.sites?.name || 'Unknown'}{' '}
          <span className="text-muted">· {scan.strategy}</span>
        </span>
      </div>

      {scan.lcp ? (
        <span className="font-mono text-[11px] text-muted hidden md:block">
          LCP {scan.lcp}
        </span>
      ) : (
        <span />
      )}

      <div className="flex items-center justify-end gap-[6px]">
        <MiniScore label="P" value={scan.performance} />
        <MiniScore label="A" value={scan.accessibility} />
        <MiniScore label="B" value={scan.best_practices} />
        <MiniScore label="S" value={scan.seo} />
      </div>
    </div>
  );
}

function MiniScore({ label, value }) {
  const tone =
    value >= 90
      ? 'bg-good-bg text-good'
      : value >= 50
      ? 'bg-warn-bg text-warn'
      : 'bg-bad-bg text-bad';
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[30px] px-[6px] py-[2px] rounded-r-pill font-mono text-[11px] font-semibold ${tone}`}
      title={`${label}: ${value}`}
    >
      {value}
    </span>
  );
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
    else
      label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(scan);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
