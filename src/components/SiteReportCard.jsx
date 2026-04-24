import Link from 'next/link';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';
import Logo from '@/components/ui/Logo';
import LineChart from '@/components/ui/charts/LineChart';

export default function SiteReportCard({ site, mobile, desktop, prevMobile, history = [] }) {
  if (!mobile && !desktop) return null;
  const primary = mobile || desktop;
  const audits = primary.audits || {};
  const criticalCount = audits.critical?.length || 0;
  const improvementCount = audits.improvement?.length || 0;
  const optionalCount = audits.optional?.length || 0;

  const perfDelta = mobile && prevMobile ? mobile.performance - prevMobile.performance : null;
  const a11yDelta = mobile && prevMobile ? mobile.accessibility - prevMobile.accessibility : null;
  const bpDelta = mobile && prevMobile ? mobile.best_practices - prevMobile.best_practices : null;
  const seoDelta = mobile && prevMobile ? mobile.seo - prevMobile.seo : null;

  const hasWPRocket = site.tags?.includes('wp-rocket');

  // Build mini trend series for the right-side chart
  const reversedHistory = [...history].reverse();
  const labels = reversedHistory.map((r) =>
    new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const series = [
    { name: 'Perf', color: '#FF5C35', points: reversedHistory.map((r) => r.performance ?? 0) },
    { name: 'A11y', color: '#F59E0B', points: reversedHistory.map((r) => r.accessibility ?? 0) },
    { name: 'BP', color: '#0EA86B', points: reversedHistory.map((r) => r.best_practices ?? 0) },
    { name: 'SEO', color: '#7B5CFF', points: reversedHistory.map((r) => r.seo ?? 0) },
  ];

  return (
    <Card className="relative overflow-hidden !p-0">
      <Link
        href={`/site/${site.id}`}
        className="absolute inset-0 z-10"
        aria-label={`View ${site.name} report`}
      />

      {/* Header */}
      <div className="relative z-20 pointer-events-none px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-line">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Logo site={site} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[16px] text-ink truncate">{site.name}</h3>
              {hasWPRocket && (
                <Pill variant="default" className="!bg-violet/10 !text-violet !border-violet/20">
                  🚀 WP Rocket
                </Pill>
              )}
            </div>
            <p className="text-[12px] text-muted truncate mt-0.5">{site.url}</p>
          </div>
        </div>
        <span className="pointer-events-auto relative z-30 inline-flex items-center gap-1 text-[12px] text-cobalt hover:underline whitespace-nowrap">
          View report →
        </span>
      </div>

      {/* Body */}
      <div className="relative z-20 pointer-events-none grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr] divide-y md:divide-y-0 md:divide-x divide-line">
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
              📱 Mobile
            </p>
            {mobile ? (
              <div className="grid grid-cols-4 gap-2">
                <ScoreCell label="Perf" value={mobile.performance} delta={perfDelta} />
                <ScoreCell label="A11y" value={mobile.accessibility} delta={a11yDelta} />
                <ScoreCell label="BP" value={mobile.best_practices} delta={bpDelta} />
                <ScoreCell label="SEO" value={mobile.seo} delta={seoDelta} />
              </div>
            ) : (
              <p className="text-[12px] text-muted">No mobile scan yet</p>
            )}
          </div>

          {primary && (
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
                Core Vitals
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <VitalLine label="LCP" value={primary.lcp} />
                <VitalLine label="FCP" value={primary.fcp} />
                <VitalLine label="TBT" value={primary.tbt} />
                <VitalLine label="CLS" value={primary.cls} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {criticalCount > 0 && <Pill variant="bad">🔴 {criticalCount} critical</Pill>}
            {improvementCount > 0 && <Pill variant="warn">🟡 {improvementCount} to improve</Pill>}
            {optionalCount > 0 && <Pill>🟢 {optionalCount} optional</Pill>}
            {criticalCount === 0 && improvementCount === 0 && (
              <Pill variant="good">✅ All passing</Pill>
            )}
          </div>
        </div>

        {/* Right: mini trend */}
        <div className="p-5 min-w-0">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
            14-day trend ({history.length} scan{history.length !== 1 ? 's' : ''})
          </p>
          {history.length >= 2 ? (
            <div className="relative">
              <LineChart series={series} labels={labels} min={0} max={105} height={180} />
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-[12px] text-muted border border-dashed border-line rounded-r-sm">
              {history.length === 0
                ? 'Not enough data for a trend yet'
                : 'Only 1 scan — need more to draw a trend'}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-20 pointer-events-none px-5 py-3 border-t border-line flex items-center justify-between text-[11px] text-muted flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {renderDeltaSummary(perfDelta, a11yDelta, bpDelta, seoDelta)}
        </div>
        <span>{primary?.scanned_at ? formatRelativeTime(primary.scanned_at) : ''}</span>
      </div>
    </Card>
  );
}

function ScoreCell({ label, value, delta }) {
  const color =
    value >= 90 ? 'text-good' : value >= 50 ? 'text-warn' : 'text-bad';
  const bg =
    value >= 90 ? 'bg-good' : value >= 50 ? 'bg-warn' : 'bg-bad';

  return (
    <div className="text-center">
      <div className="h-[4px] rounded-full bg-paper-2 mb-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${bg} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`font-serif text-[22px] leading-none ${color}`}>{value}</span>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-[10px] font-semibold ${delta > 0 ? 'text-good' : 'text-bad'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function VitalLine({ label, value }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink-2 font-mono font-medium">{value || '—'}</span>
    </div>
  );
}

function renderDeltaSummary(perf, a11y, bp, seo) {
  const deltas = [
    { label: 'perf', value: perf },
    { label: 'a11y', value: a11y },
    { label: 'bp', value: bp },
    { label: 'seo', value: seo },
  ].filter((d) => d.value !== null && d.value !== 0);

  if (deltas.length === 0) return <span>No change since last scan</span>;

  return (
    <>
      <span className="text-muted">Δ vs last scan:</span>
      {deltas.map((d) => (
        <span key={d.label} className={d.value > 0 ? 'text-good font-medium' : 'text-bad font-medium'}>
          {d.value > 0 ? '+' : ''}
          {d.value} {d.label}
        </span>
      ))}
    </>
  );
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diffMs = new Date() - new Date(dateStr);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
