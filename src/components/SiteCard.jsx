import Link from 'next/link';
import ScoreRing from './ScoreRing';
import SeverityCounts from './SeverityCounts';

export default function SiteCard({ site, mobile, desktop, prevMobile, prevDesktop }) {
  const result = mobile || desktop;
  if (!result) return null;

  const prev = mobile ? prevMobile : prevDesktop;
  const audits = result.audits || {};
  const perfDelta = prev ? result.performance - prev.performance : null;

  return (
    <Link
      href={`/site/${site.id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">{site.name}</h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">{site.url}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {formatRelativeTime(result.scanned_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {perfDelta !== null && perfDelta !== 0 && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              perfDelta > 0
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {perfDelta > 0 ? '+' : ''}{perfDelta}
            </span>
          )}
          <StrategyBadge strategy={mobile ? 'mobile' : 'desktop'} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <ScoreRing score={result.performance} size={64} label="Perf" />
        <ScoreRing score={result.accessibility} size={64} label="A11y" />
        <ScoreRing score={result.best_practices} size={64} label="BP" />
        <ScoreRing score={result.seo} size={64} label="SEO" />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <VitalPill label="FCP" value={result.fcp} />
        <VitalPill label="LCP" value={result.lcp} />
        <VitalPill label="TBT" value={result.tbt} />
        <VitalPill label="CLS" value={result.cls} />
      </div>

      <SeverityCounts
        critical={audits.critical?.length || 0}
        improvement={audits.improvement?.length || 0}
        optional={audits.optional?.length || 0}
      />
    </Link>
  );
}

function StrategyBadge({ strategy }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400">
      {strategy}
    </span>
  );
}

function VitalPill({ label, value }) {
  if (!value) return null;
  return (
    <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
      {label} {value}
    </span>
  );
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
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
