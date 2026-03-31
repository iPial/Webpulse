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

export default function VitalsChart({ data }) {
  if (!data || data.length === 0) return null;

  // Filter to entries with vitals data
  const chartData = [...data]
    .reverse()
    .filter((row) => row.avg_fcp_ms || row.avg_lcp_ms)
    .map((row) => ({
      month: row.month,
      FCP: row.avg_fcp_ms ? Math.round(row.avg_fcp_ms / 100) / 10 : null,
      LCP: row.avg_lcp_ms ? Math.round(row.avg_lcp_ms / 100) / 10 : null,
    }));

  if (chartData.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Core Web Vitals Trend</h3>
      <p className="text-[10px] text-gray-500 mb-4">FCP and LCP in seconds (lower is better)</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            width={30}
            unit="s"
          />
          {/* LCP thresholds */}
          <ReferenceLine y={2.5} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: 'Good', fill: '#10B98180', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: 'Poor', fill: '#EF444480', fontSize: 9, position: 'right' }} />
          <Tooltip content={<VitalsTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#9CA3AF', paddingTop: '8px' }} />
          <Line type="monotone" dataKey="FCP" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} connectNulls />
          <Line type="monotone" dataKey="LCP" stroke="#F97316" strokeWidth={2} dot={{ r: 4, fill: '#F97316' }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VitalsTooltip({ active, payload, label }) {
  if (!active || !payload) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300">{entry.name}</span>
          </span>
          <span className="font-bold" style={{ color: entry.color }}>{entry.value}s</span>
        </div>
      ))}
    </div>
  );
}
