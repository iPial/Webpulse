export default function HistoryTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <p className="text-sm text-gray-400">No history data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Month</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Performance</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Accessibility</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Best Practices</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">SEO</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Critical</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Improve</th>
              <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Avg FCP</th>
              <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Avg LCP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const prev = data[i + 1];
              return (
                <tr key={row.month} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm text-white font-medium">{row.month}</span>
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBarCell value={row.performance} prev={prev?.performance} />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBarCell value={row.accessibility} prev={prev?.accessibility} />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBarCell value={row.best_practices} prev={prev?.best_practices} />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBarCell value={row.seo} prev={prev?.seo} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.critical_count > 0 ? (
                      <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                        {row.critical_count}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-700">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.improvement_count > 0 ? (
                      <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        {row.improvement_count}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-700">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <VitalCell value={row.avg_fcp_ms} goodMs={1800} poorMs={3000} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <VitalCell value={row.avg_lcp_ms} goodMs={2500} poorMs={4000} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreBarCell({ value, prev }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-gray-700">—</span>;
  }

  const color = value >= 90 ? '#10B981' : value >= 50 ? '#F59E0B' : '#EF4444';
  const textColor = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  const delta = prev != null ? value - prev : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-1">
        <span className={`text-xs font-bold ${textColor}`}>{value}</span>
        {delta !== null && delta !== 0 && (
          <span className={`text-[9px] font-medium ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {delta > 0 ? '\u25B2' : '\u25BC'}{Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden max-w-[60px]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function VitalCell({ value, goodMs, poorMs }) {
  if (!value) return <span className="text-xs text-gray-700">—</span>;

  const seconds = (value / 1000).toFixed(1);
  const color = value <= goodMs ? 'text-score-good' : value <= poorMs ? 'text-score-average' : 'text-score-poor';

  return <span className={`text-xs font-medium ${color}`}>{seconds}s</span>;
}
