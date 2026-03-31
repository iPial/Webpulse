import Link from 'next/link';
import ScoreRing from './ScoreRing';

export default function SiteCard({ site, mobile, desktop, prevMobile, prevDesktop }) {
  if (!mobile && !desktop) return null;

  const primaryResult = mobile || desktop;
  const perfDelta = mobile && prevMobile ? mobile.performance - prevMobile.performance : null;
  const audits = primaryResult.audits || {};
  const criticalCount = audits.critical?.length || 0;
  const improvementCount = audits.improvement?.length || 0;

  return (
    <Link
      href={`/site/${site.id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-black/20"
    >
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">{site.name}</h3>
            <p className="text-xs text-gray-500 truncate">{site.url}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {perfDelta !== null && perfDelta !== 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                perfDelta > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {perfDelta > 0 ? '+' : ''}{perfDelta}
              </span>
            )}
            <span className="text-[10px] text-gray-600">
              {formatRelativeTime(primaryResult.scanned_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Scores — Mobile & Desktop side by side */}
      <div className="px-5 py-4">
        {mobile && desktop ? (
          <div className="grid grid-cols-2 gap-4">
            <StrategyScores label="Mobile" result={mobile} />
            <StrategyScores label="Desktop" result={desktop} />
          </div>
        ) : (
          <StrategyScores label={mobile ? 'Mobile' : 'Desktop'} result={primaryResult} />
        )}
      </div>

      {/* Vitals Grid */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-5 gap-1">
          <Vital label="FCP" value={primaryResult.fcp} />
          <Vital label="LCP" value={primaryResult.lcp} />
          <Vital label="TBT" value={primaryResult.tbt} />
          <Vital label="CLS" value={primaryResult.cls} />
          <Vital label="SI" value={primaryResult.si} />
        </div>
      </div>

      {/* Footer — Audit Counts */}
      <div className="px-5 py-3 border-t border-gray-800/50 flex items-center gap-3">
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {criticalCount} critical
          </span>
        )}
        {improvementCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-400">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {improvementCount} to improve
          </span>
        )}
        {criticalCount === 0 && improvementCount === 0 && (
          <span className="flex items-center gap-1 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            All passing
          </span>
        )}
      </div>
    </Link>
  );
}

function StrategyScores({ label, result }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="grid grid-cols-4 gap-1">
        <ScoreItem label="Perf" value={result.performance} />
        <ScoreItem label="A11y" value={result.accessibility} />
        <ScoreItem label="BP" value={result.best_practices} />
        <ScoreItem label="SEO" value={result.seo} />
      </div>
    </div>
  );
}

function ScoreItem({ label, value }) {
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  const bgColor = value >= 90 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="text-center">
      <div className="h-1 rounded-full bg-gray-800 mb-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${bgColor}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
      <p className="text-[9px] text-gray-600">{label}</p>
    </div>
  );
}

function Vital({ label, value }) {
  if (!value) return <div className="text-center text-[9px] text-gray-700">—</div>;
  return (
    <div className="text-center bg-gray-800/50 rounded py-1 px-0.5">
      <p className="text-[9px] text-gray-500">{label}</p>
      <p className="text-[10px] text-gray-300 font-medium">{value}</p>
    </div>
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
