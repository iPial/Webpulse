import ScoreRing from './ScoreRing';

export default function OverviewStats({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <CountCard
        label="Sites Monitored"
        value={stats.siteCount}
        color="text-blue-400"
      />
      <StatCard label="Avg Performance" value={stats.avgPerformance} />
      <StatCard label="Avg Accessibility" value={stats.avgAccessibility} />
      <StatCard label="Avg Best Practices" value={stats.avgBestPractices} />
      <StatCard label="Avg SEO" value={stats.avgSEO} />
      <CountCard
        label="Critical Issues"
        value={stats.criticalTotal}
        color={stats.criticalTotal > 0 ? 'text-score-poor' : 'text-score-good'}
      />
    </div>
  );
}

function StatCard({ label, value }) {
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-3">
      <ScoreRing score={value} size={48} strokeWidth={4} />
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function CountCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col justify-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
