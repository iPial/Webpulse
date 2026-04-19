import { formatDelta, deltaTextColor } from '@/lib/deltas';

export default function ScanHistoryTable({ results }) {
  if (!results || results.length === 0) return null;

  // Find the previous scan of the same strategy for each row (next older)
  function findPrev(row, index) {
    for (let i = index + 1; i < results.length; i++) {
      if (results[i].strategy === row.strategy) return results[i];
    }
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Scan History</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2">Date</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">Strategy</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">Perf</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">A11y</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">BP</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">SEO</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">FCP</th>
              <th className="text-center text-xs font-medium text-gray-400 px-2 py-2">LCP</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => {
              const prev = findPrev(row, idx);
              return (
                <tr key={row.id} className="border-b border-gray-800/50 last:border-0">
                  <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(row.scanned_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
                      {row.strategy}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ScoreWithDelta value={row.performance} prev={prev?.performance} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ScoreWithDelta value={row.accessibility} prev={prev?.accessibility} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ScoreWithDelta value={row.best_practices} prev={prev?.best_practices} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <ScoreWithDelta value={row.seo} prev={prev?.seo} />
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-gray-400">
                    {row.fcp || '—'}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-gray-400">
                    {row.lcp || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-600 mt-3">
        Delta arrows compare each row to the previous scan of the same strategy.
      </p>
    </div>
  );
}

function ScoreWithDelta({ value, prev }) {
  if (value === null || value === undefined) return <span className="text-gray-600">—</span>;
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  const delta = prev !== null && prev !== undefined ? value - prev : null;
  return (
    <div className="leading-tight">
      <span className={`text-xs font-medium ${color}`}>{value}</span>
      {delta !== null && delta !== 0 && (
        <span className={`text-[9px] ml-1 font-semibold ${deltaTextColor(delta)}`}>
          {formatDelta(delta)}
        </span>
      )}
    </div>
  );
}
