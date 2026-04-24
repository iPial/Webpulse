import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';

export default function HistoryTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <Card variant="hairline" className="text-center py-10">
        <p className="text-[13px] text-muted">No history data yet.</p>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="px-2 pt-2 mb-3">
        <h3 className="font-semibold text-[15px] text-ink">Monthly breakdown</h3>
        <p className="text-[12px] text-muted mt-0.5">
          Average score per month · delta arrows compare to the previous month
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
              <th className="text-left px-3 py-2.5">Month</th>
              <th className="text-center px-3 py-2.5">Performance</th>
              <th className="text-center px-3 py-2.5">A11y</th>
              <th className="text-center px-3 py-2.5">BP</th>
              <th className="text-center px-3 py-2.5">SEO</th>
              <th className="text-center px-3 py-2.5">Critical</th>
              <th className="text-center px-3 py-2.5">Improve</th>
              <th className="text-center px-3 py-2.5">Avg FCP</th>
              <th className="text-right px-3 py-2.5">Avg LCP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const prev = data[i + 1];
              const isLatest = i === 0;
              return (
                <tr
                  key={row.month}
                  className="border-b border-line/60 last:border-0 hover:bg-paper-2/40 transition-colors"
                >
                  <td className="px-3 py-3">
                    <Pill variant={isLatest ? 'ink' : 'default'}>{row.month}</Pill>
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
                      <Pill variant="bad">{row.critical_count}</Pill>
                    ) : (
                      <span className="text-[11px] text-muted">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.improvement_count > 0 ? (
                      <Pill variant="warn">{row.improvement_count}</Pill>
                    ) : (
                      <span className="text-[11px] text-muted">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <VitalCell value={row.avg_fcp_ms} goodMs={1800} poorMs={3000} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <VitalCell value={row.avg_lcp_ms} goodMs={2500} poorMs={4000} />
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

function ScoreBarCell({ value, prev }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] text-muted">—</span>;
  }

  const color = value >= 90 ? 'var(--good)' : value >= 50 ? 'var(--warn)' : 'var(--bad)';
  const textColor =
    value >= 90 ? 'text-good' : value >= 50 ? 'text-warn' : 'text-bad';
  const delta = prev != null ? value - prev : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-baseline gap-1">
        <span className={`font-serif text-[22px] leading-none tracking-tight ${textColor}`}>
          {value}
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-[10px] font-semibold ${delta > 0 ? 'text-good' : 'text-bad'}`}
          >
            {delta > 0 ? '▲' : '▼'}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="w-full h-[4px] rounded-full bg-paper-2 overflow-hidden max-w-[60px]">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function VitalCell({ value, goodMs, poorMs }) {
  if (!value) return <span className="text-[11px] text-muted">—</span>;
  const seconds = (value / 1000).toFixed(1);
  const color = value <= goodMs ? 'text-good' : value <= poorMs ? 'text-warn' : 'text-bad';
  return <span className={`font-mono text-[12px] font-medium ${color}`}>{seconds}s</span>;
}
