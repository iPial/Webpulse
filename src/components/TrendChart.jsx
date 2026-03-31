'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

export default function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <p className="text-sm text-gray-400">No trend data available yet.</p>
      </div>
    );
  }

  const chartData = [...data].reverse().map((row) => ({
    month: row.month,
    Performance: row.performance,
    Accessibility: row.accessibility,
    'Best Practices': row.best_practices,
    SEO: row.seo,
  }));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Score Trends</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
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
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#9CA3AF', paddingTop: '8px' }}
          />
          <Line type="monotone" dataKey="Performance" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="Accessibility" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="Best Practices" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4, fill: '#8B5CF6' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="SEO" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
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
          <span className="font-bold" style={{ color: entry.color }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
