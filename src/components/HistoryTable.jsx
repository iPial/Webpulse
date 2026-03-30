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
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Month</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Perf</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">A11y</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">BP</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">SEO</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Critical</th>
            <th className="text-center text-xs font-medium text-gray-400 px-3 py-3">Improve</th>
            <th className="text-right text-xs font-medium text-gray-400 px-5 py-3">Avg LCP</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const prev = data[i + 1]; // next row is previous month (data is newest-first)
            return (
              <tr key={row.month} className="border-b border-gray-800/50 last:border-0">
                <td className="px-5 py-3 text-sm text-white font-medium">{row.month}</td>
                <td className="px-3 py-3 text-center">
                  <ScoreCell value={row.performance} prev={prev?.performance} />
                </td>
                <td className="px-3 py-3 text-center">
                  <ScoreCell value={row.accessibility} prev={prev?.accessibility} />
                </td>
                <td className="px-3 py-3 text-center">
                  <ScoreCell value={row.best_practices} prev={prev?.best_practices} />
                </td>
                <td className="px-3 py-3 text-center">
                  <ScoreCell value={row.seo} prev={prev?.seo} />
                </td>
                <td className="px-3 py-3 text-center text-sm">
                  {row.critical_count > 0 ? (
                    <span className="text-red-400">{row.critical_count}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-sm">
                  {row.improvement_count > 0 ? (
                    <span className="text-yellow-400">{row.improvement_count}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-sm text-gray-300">
                  {row.avg_lcp_ms ? `${(row.avg_lcp_ms / 1000).toFixed(1)}s` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({ value, prev }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600">—</span>;
  }

  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  const delta = prev != null ? value - prev : null;

  return (
    <span className={`text-sm font-medium ${color}`}>
      {value}
      {delta !== null && delta !== 0 && (
        <span className={`text-[10px] ml-0.5 ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </span>
  );
}
