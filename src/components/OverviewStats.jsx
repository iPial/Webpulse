import ScoreRing from './ScoreRing';

export default function OverviewStats({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Avg Performance" value={stats.avgPerformance} />
      <StatCard label="Avg Accessibility" value={stats.avgAccessibility} />
      <StatCard label="Avg Best Practices" value={stats.avgBestPractices} />
      <StatCard label="Avg SEO" value={stats.avgSEO} />
    </div>
  );
}

function StatCard({ label, value }) {
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-4">
      <ScoreRing score={value} size={56} strokeWidth={4} />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
