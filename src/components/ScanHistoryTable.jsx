import { formatDelta, deltaTextColor } from '@/lib/deltas';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';

export default function ScanHistoryTable({ results }) {
  if (!results || results.length === 0) return null;

  function findPrev(row, index) {
    for (let i = index + 1; i < results.length; i++) {
      if (results[i].strategy === row.strategy) return results[i];
    }
    return null;
  }

  return (
    <Card padding="sm">
      <div className="px-2 pt-2 mb-3">
        <h3 className="font-semibold text-[15px] text-ink">Scan history</h3>
        <p className="text-[12px] text-muted mt-0.5">
          Delta arrows compare each row to the previous scan of the same strategy.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
              <th className="text-left px-3 py-2.5">Date</th>
              <th className="text-center px-3 py-2.5">Strategy</th>
              <th className="text-center px-3 py-2.5">Perf</th>
              <th className="text-center px-3 py-2.5">A11y</th>
              <th className="text-center px-3 py-2.5">BP</th>
              <th className="text-center px-3 py-2.5">SEO</th>
              <th className="text-center px-3 py-2.5">FCP</th>
              <th className="text-center px-3 py-2.5">LCP</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, idx) => {
              const prev = findPrev(row, idx);
              return (
                <tr
                  key={row.id}
                  className="border-b border-line/60 last:border-0 hover:bg-paper-2/40 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-[12px] text-muted whitespace-nowrap">
                    {new Date(row.scanned_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Pill variant={row.strategy === 'mobile' ? 'ink' : 'default'}>
                      {row.strategy}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ScoreWithDelta value={row.performance} prev={prev?.performance} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ScoreWithDelta value={row.accessibility} prev={prev?.accessibility} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ScoreWithDelta value={row.best_practices} prev={prev?.best_practices} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ScoreWithDelta value={row.seo} prev={prev?.seo} />
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-[12px] text-ink-2">
                    {row.fcp || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-[12px] text-ink-2">
                    {row.lcp || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScoreWithDelta({ value, prev }) {
  if (value === null || value === undefined)
    return <span className="text-muted">—</span>;
  const color =
    value >= 90 ? 'text-good' : value >= 50 ? 'text-warn' : 'text-bad';
  const delta = prev !== null && prev !== undefined ? value - prev : null;
  return (
    <div className="leading-tight">
      <span className={`font-mono text-[13px] font-semibold ${color}`}>{value}</span>
      {delta !== null && delta !== 0 && (
        <span className={`text-[10px] ml-1 font-semibold ${deltaTextColor(delta)}`}>
          {formatDelta(delta)}
        </span>
      )}
    </div>
  );
}
