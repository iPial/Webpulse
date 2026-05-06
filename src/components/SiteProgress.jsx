import Card from '@/components/ui/Card';
import LineChart from '@/components/ui/charts/LineChart';

// Accepts all scan results for this site (newest first) and a strategy
// ('mobile' or 'desktop'). Filters internally so the same component drives
// the deltas table, the score history chart, and the Core Web Vitals chart
// in lockstep with the page-level strategy toggle.
export default function SiteProgress({ results, strategy = 'mobile' }) {
  const filteredResults = (results || []).filter((r) => r.strategy === strategy);
  if (filteredResults.length === 0) return null;

  // Keep the variable name `mobileResults` everywhere below to minimize the
  // diff churn — it now means "results for the selected strategy".
  const mobileResults = filteredResults;

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

  // Core Web Vitals series — FCP + LCP in seconds, only for scans that
  // have parseable values. Same shape used by the History page CWV card.
  const cwvRows = reversed.filter((r) => parseSeconds(r.fcp) != null || parseSeconds(r.lcp) != null);
  const cwvLabels = cwvRows.map((r) =>
    new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const cwvSeries = cwvRows.length
    ? [
        { name: 'FCP', color: '#BEE5FF', points: cwvRows.map((r) => parseSeconds(r.fcp) ?? 0) },
        { name: 'LCP', color: '#D6FF3C', points: cwvRows.map((r) => parseSeconds(r.lcp) ?? 0) },
      ]
    : [];
  const cwvMax = cwvSeries.length
    ? Math.max(25, Math.ceil(Math.max(...cwvSeries.flatMap((s) => s.points)) + 2))
    : 25;

  return (
    <Card padding="sm">
      <div className="px-2 pt-2 mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-[15px] text-ink">Progress</h2>
          <p className="text-[12px] text-muted mt-0.5">
            {mobileResults.length} {strategy} scan{mobileResults.length !== 1 ? 's' : ''} tracked
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

      {/* Two charts side-by-side on wide screens, stacked on mobile/tablet:
          • Score history (Perf/A11y/BP/SEO trend)
          • Core Web Vitals (FCP/LCP in seconds — ink card variant matches
            the History page treatment for visual consistency). */}
      <div className="px-2 pb-2 grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] grid-cols-1 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted mb-3">
            Score history ({strategy}, last {Math.min(mobileResults.length, 30)} scans)
          </p>
          {reversed.length >= 2 ? (
            <LineChart series={series} labels={labels} min={0} max={105} height={260} />
          ) : (
            <p className="text-[13px] text-muted py-8 text-center">
              Not enough data for a trend yet.
            </p>
          )}
        </div>

        <div className="bg-ink rounded-r-md p-4 text-surface flex flex-col">
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-lime mb-1">
            Core Web Vitals
          </p>
          <p className="text-[12px] text-white/60 mb-3">
            FCP &amp; LCP in seconds · lower is better
          </p>
          {cwvSeries.length && cwvRows.length >= 2 ? (
            <>
              <LineChart
                series={cwvSeries}
                labels={cwvLabels}
                min={0}
                max={cwvMax}
                height={200}
                background="ink"
              />
              <div className="flex flex-wrap gap-3 text-[11px] text-white/70 mt-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-[#BEE5FF]" />FCP
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-[#D6FF3C]" />LCP
                </span>
                <span className="inline-flex items-center gap-1.5 text-good">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-good" />Good &lt; 2.5s
                </span>
                <span className="inline-flex items-center gap-1.5 text-orange">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-orange" />Poor &gt; 4s
                </span>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-white/50 py-8 text-center">
              Not enough Core Web Vitals data yet.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Parse a vital displayValue like "6.8 s", "2,170 ms", or "0.043" into
// a numeric seconds value. CLS-style unitless values fall through as-is.
// Used to feed the Core Web Vitals trend chart from raw scan_results rows.
function parseSeconds(displayValue) {
  if (!displayValue) return null;
  const s = String(displayValue).toLowerCase().replace(/,/g, '').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  if (s.endsWith('ms')) return n / 1000;
  if (s.endsWith('s')) return n;
  return n; // unitless — caller decides how to interpret
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
