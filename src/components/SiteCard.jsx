import Link from 'next/link';
import ScoreRing from './ScoreRing';
import SeverityCounts from './SeverityCounts';

export default function SiteCard({ site, mobile, desktop }) {
  const result = mobile || desktop;
  if (!result) return null;

  const audits = result.audits || {};

  return (
    <Link
      href={`/site/${site.id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">{site.name}</h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">{site.url}</p>
        </div>
        <StrategyBadge strategy={mobile ? 'mobile' : 'desktop'} />
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
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400">
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
