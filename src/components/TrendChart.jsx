'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <p className="text-sm text-gray-400">No trend data available yet.</p>
      </div>
    );
  }

  // Data comes newest-first from DB, reverse for chart (left = oldest)
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
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            itemStyle={{ color: '#E5E7EB' }}
            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }}
          />
          <Bar dataKey="Performance" fill="#10B981" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Accessibility" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Best Practices" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="SEO" fill="#F59E0B" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
