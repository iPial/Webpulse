export default function ScanHistoryTable({ results }) {
  if (!results || results.length === 0) return null;

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
            {results.map((row) => (
              <tr key={row.id} className="border-b border-gray-800/50 last:border-0">
                <td className="px-3 py-2 text-xs text-gray-400">
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
                  <ScoreVal value={row.performance} />
                </td>
                <td className="px-2 py-2 text-center">
                  <ScoreVal value={row.accessibility} />
                </td>
                <td className="px-2 py-2 text-center">
                  <ScoreVal value={row.best_practices} />
                </td>
                <td className="px-2 py-2 text-center">
                  <ScoreVal value={row.seo} />
                </td>
                <td className="px-2 py-2 text-center text-xs text-gray-400">
                  {row.fcp || '—'}
                </td>
                <td className="px-2 py-2 text-center text-xs text-gray-400">
                  {row.lcp || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreVal({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-600">—</span>;
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  return <span className={`text-xs font-medium ${color}`}>{value}</span>;
}
