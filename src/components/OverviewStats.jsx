import ScoreRing from './ScoreRing';

export default function OverviewStats({ stats }) {
  const healthScore = Math.round(
    (stats.avgPerformance + stats.avgAccessibility + stats.avgBestPractices + stats.avgSEO) / 4
  );
  const healthColor = healthScore >= 90 ? 'text-score-good' : healthScore >= 50 ? 'text-score-average' : 'text-score-poor';

  return (
    <div className="space-y-4">
      {/* Hero Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex items-center gap-5">
          <ScoreRing score={healthScore} size={80} strokeWidth={6} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Health Score</p>
            <p className={`text-3xl font-bold ${healthColor}`}>{healthScore}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Avg of all categories</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 grid grid-cols-2 gap-4">
          <MiniStat label="Sites" value={stats.siteCount} color="text-blue-400" />
          <MiniStat
            label="Critical"
            value={stats.criticalTotal}
            color={stats.criticalTotal > 0 ? 'text-red-400' : 'text-green-400'}
          />
          <MiniStat
            label="To Improve"
            value={stats.improvementTotal}
            color={stats.improvementTotal > 0 ? 'text-yellow-400' : 'text-green-400'}
          />
          <MiniStat
            label="Worst Perf"
            value={stats.worstPerformance ?? '—'}
            color="text-red-400"
            subtitle={stats.worstSiteName}
          />
        </div>

        {/* Score Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Average Scores</p>
          <div className="grid grid-cols-4 gap-3">
            <ScoreBar label="Performance" value={stats.avgPerformance} />
            <ScoreBar label="Accessibility" value={stats.avgAccessibility} />
            <ScoreBar label="Best Practices" value={stats.avgBestPractices} />
            <ScoreBar label="SEO" value={stats.avgSEO} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, subtitle }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-600 truncate">{subtitle}</p>}
    </div>
  );
}

function ScoreBar({ label, value }) {
  const color = value >= 90 ? '#10B981' : value >= 50 ? '#F59E0B' : '#EF4444';
  const textColor = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
