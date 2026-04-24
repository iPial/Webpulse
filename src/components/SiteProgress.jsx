import Card from '@/components/ui/Card';
import LineChart from '@/components/ui/charts/LineChart';

// Accepts all mobile scan results for this site (newest first).
// Computes deltas for: since-last-scan, vs 7 days ago, vs 30 days ago.
export default function SiteProgress({ results }) {
  const mobileResults = (results || []).filter((r) => r.strategy === 'mobile');
  if (mobileResults.length === 0) return null;

  const latest = mobileResults[0];
  const prev = mobileResults[1] || null;

  const now = new Date(latest.scanned_at);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const olderThan = (date) =>
    mobileResults.find((r) => new Date(r.scanned_at) <= date) || null;

  const weekAgo = olderThan(sevenDaysAgo);
  const monthAgo = olderThan(thirtyDaysAgo);

  // oldest-first for chart, cap at 30
  const reversed = mobileResults.slice(0, 30).reverse();
  const labels = reversed.map((r) =>
    new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const series = [
    { name: 'Perf', color: '#FF5C35', points: reversed.map((r) => r.performance ?? 0) },
    { name: 'A11y', color: '#F59E0B', points: reversed.map((r) => r.accessibility ?? 0) },
    { name: 'BP', color: '#0EA86B', points: reversed.map((r) => r.best_practices ?? 0) },
    { name: 'SEO', color: '#7B5CFF', points: reversed.map((r) => r.seo ?? 0) },
  ];

  return (
    <Card padding="sm">
      <div className="px-2 pt-2 mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-[15px] text-ink">Progress</h2>
          <p className="text-[12px] text-muted mt-0.5">
            {mobileResults.length} mobile scan{mobileResults.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>

      {/* Deltas */}
      <div className="overflow-x-auto border-b border-line pb-3 mb-4">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-[0.1em] font-semibold text-muted pb-2 px-2">
                Metric
              </th>
              <th className="text-center text-[11px] uppercase tracking-[0.1em] font-semibold text-muted pb-2 px-2">
                Current
              </th>
              <th className="text-center text-[11px] uppercase tracking-[0.1em] font-semibold text-muted pb-2 px-2">
                vs last scan
              </th>
              <th className="text-center text-[11px] uppercase tracking-[0.1em] font-semibold text-muted pb-2 px-2">
                vs 7 days ago
              </th>
              <th className="text-center text-[11px] uppercase tracking-[0.1em] font-semibold text-muted pb-2 px-2">
                vs 30 days ago
              </th>
            </tr>
          </thead>
          <tbody>
            <DeltaRow label="Performance" current={latest.performance} prev={prev?.performance} week={weekAgo?.performance} month={monthAgo?.performance} />
            <DeltaRow label="Accessibility" current={latest.accessibility} prev={prev?.accessibility} week={weekAgo?.accessibility} month={monthAgo?.accessibility} />
            <DeltaRow label="Best Practices" current={latest.best_practices} prev={prev?.best_practices} week={weekAgo?.best_practices} month={monthAgo?.best_practices} />
            <DeltaRow label="SEO" current={latest.seo} prev={prev?.seo} week={weekAgo?.seo} month={monthAgo?.seo} />
          </tbody>
        </table>
      </div>

      {/* Trend chart */}
      <div className="px-2 pb-2">
        <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted mb-3">
          Score history (mobile, last {Math.min(mobileResults.length, 30)} scans)
        </p>
        {reversed.length >= 2 ? (
          <LineChart series={series} labels={labels} min={0} max={105} height={260} />
        ) : (
          <p className="text-[13px] text-muted py-8 text-center">
            Not enough data for a trend yet.
          </p>
        )}
      </div>
    </Card>
  );
}

function DeltaRow({ label, current, prev, week, month }) {
  const color =
    current >= 90 ? 'text-good' : current >= 50 ? 'text-warn' : 'text-bad';
  return (
    <tr className="border-t border-line/60">
      <td className="py-2 px-2 text-[13px] text-ink-2">{label}</td>
      <td className="py-2 px-2 text-center">
        <span className={`font-serif text-[22px] leading-none ${color}`}>
          {current ?? '—'}
        </span>
      </td>
      <td className="py-2 px-2 text-center">
        <DeltaCell current={current} base={prev} />
      </td>
      <td className="py-2 px-2 text-center">
        <DeltaCell current={current} base={week} />
      </td>
      <td className="py-2 px-2 text-center">
        <DeltaCell current={current} base={month} />
      </td>
    </tr>
  );
}

function DeltaCell({ current, base }) {
  if (base === null || base === undefined) {
    return <span className="text-[11px] text-muted">—</span>;
  }
  const delta = current - base;
  if (delta === 0) return <span className="text-[11px] text-muted">no change</span>;
  const positive = delta > 0;
  return (
    <span
      className={`text-[12px] font-semibold ${
        positive ? 'text-good' : 'text-bad'
      }`}
    >
      {positive ? '▲ +' : '▼ '}
      {delta}
      <span className="text-[10px] text-muted ml-1">from {base}</span>
    </span>
  );
}
