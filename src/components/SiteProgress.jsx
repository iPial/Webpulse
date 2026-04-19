'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

// Accepts all mobile scan results for this site (newest first).
// Computes deltas for: since-last-scan, vs 7 days ago, vs 30 days ago.
export default function SiteProgress({ results }) {
  // Filter to mobile-only, keep newest-first order
  const mobileResults = (results || []).filter((r) => r.strategy === 'mobile');

  if (mobileResults.length === 0) {
    return null;
  }

  const latest = mobileResults[0];
  const prev = mobileResults[1] || null;

  const now = new Date(latest.scanned_at);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  // Find the closest scan older than each window boundary
  const olderThan = (date) =>
    mobileResults.find((r) => new Date(r.scanned_at) <= date) || null;

  const weekAgo = olderThan(sevenDaysAgo);
  const monthAgo = olderThan(thirtyDaysAgo);

  // Reverse for chart (oldest → newest), cap at 30 points to keep it readable
  const chartData = mobileResults
    .slice(0, 30)
    .reverse()
    .map((r) => ({
      date: new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Performance: r.performance,
      Accessibility: r.accessibility,
      'Best Practices': r.best_practices,
      SEO: r.seo,
    }));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Progress</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {mobileResults.length} mobile scan{mobileResults.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>

      {/* Deltas table */}
      <div className="px-5 py-4 border-b border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider pb-2 font-medium">Metric</th>
              <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider pb-2 font-medium">Current</th>
              <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider pb-2 font-medium">vs last scan</th>
              <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider pb-2 font-medium">vs 7 days ago</th>
              <th className="text-center text-[10px] text-gray-500 uppercase tracking-wider pb-2 font-medium">vs 30 days ago</th>
            </tr>
          </thead>
          <tbody>
            <DeltaRow label="Performance" current={latest.performance} prev={prev?.performance} week={weekAgo?.performance} month={monthAgo?.performance} />
            <DeltaRow label="Accessibility" current={latest.accessibility} prev={prev?.accessibility} week={weekAgo?.accessibility} month={monthAgo?.accessibility} />
            <DeltaRow label="Best Practices" current={latest.best_practices} prev={prev?.best_practices} week={weekAgo?.best_practices} month={monthAgo?.best_practices} />
            <DeltaRow label="SEO" current={latest.seo} prev={prev?.seo} week={weekAgo?.seo} month={monthAgo?.seo} />
          </tbody>
        </table>
      </div>

      {/* Trend chart */}
      <div className="px-5 py-4">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
          Score history (mobile, last {Math.min(mobileResults.length, 30)} scans)
        </p>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                width={30}
              />
              <ReferenceLine y={90} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.3} />
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.3} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF', paddingTop: 8 }} />
              <Line type="monotone" dataKey="Performance" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Accessibility" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Best Practices" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3, fill: '#8B5CF6' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="SEO" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-500 py-8 text-center">Not enough data for a trend yet.</p>
        )}
      </div>
    </div>
  );
}

function DeltaRow({ label, current, prev, week, month }) {
  const color = current >= 90 ? 'text-green-400' : current >= 50 ? 'text-yellow-400' : 'text-red-400';
  return (
    <tr className="border-t border-gray-800/50">
      <td className="py-2 text-xs text-gray-400">{label}</td>
      <td className={`py-2 text-center text-base font-bold ${color}`}>{current ?? '—'}</td>
      <td className="py-2 text-center"><DeltaCell current={current} base={prev} /></td>
      <td className="py-2 text-center"><DeltaCell current={current} base={week} /></td>
      <td className="py-2 text-center"><DeltaCell current={current} base={month} /></td>
    </tr>
  );
}

function DeltaCell({ current, base }) {
  if (base === null || base === undefined) {
    return <span className="text-xs text-gray-600">—</span>;
  }
  const delta = current - base;
  if (delta === 0) return <span className="text-xs text-gray-500">no change</span>;
  const positive = delta > 0;
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '▲ +' : '▼ '}{delta}
      <span className="text-[10px] text-gray-500 ml-1">from {base}</span>
    </span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-gray-300">{e.name}</span>
          </span>
          <span className="font-bold" style={{ color: e.color }}>{e.value}</span>
        </div>
      ))}
    </div>
  );
}
