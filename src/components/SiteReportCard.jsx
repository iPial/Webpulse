'use client';

import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { resolveLogoUrl } from '@/lib/logos';

export default function SiteReportCard({ site, mobile, desktop, prevMobile, history = [] }) {
  if (!mobile && !desktop) return null;
  const primary = mobile || desktop;
  const audits = primary.audits || {};
  const criticalCount = audits.critical?.length || 0;
  const improvementCount = audits.improvement?.length || 0;
  const optionalCount = audits.optional?.length || 0;

  // Deltas vs previous scan
  const perfDelta = mobile && prevMobile ? mobile.performance - prevMobile.performance : null;
  const a11yDelta = mobile && prevMobile ? mobile.accessibility - prevMobile.accessibility : null;
  const bpDelta = mobile && prevMobile ? mobile.best_practices - prevMobile.best_practices : null;
  const seoDelta = mobile && prevMobile ? mobile.seo - prevMobile.seo : null;

  const hasWPRocket = site.tags?.includes('wp-rocket');

  return (
    <div className="relative rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors overflow-hidden">
      {/* Card-wide link (behind content, so individual interactive elements still work) */}
      <Link href={`/site/${site.id}`} className="absolute inset-0 z-10" aria-label={`View ${site.name} report`} />

      {/* Header */}
      <div className="relative z-20 pointer-events-none px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-gray-800">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {(() => {
            const logo = resolveLogoUrl(site);
            if (!logo) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="w-9 h-9 rounded-lg border border-gray-800 bg-gray-950 object-contain p-1 shrink-0 mt-0.5"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            );
          })()}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white truncate">{site.name}</h3>
              {hasWPRocket && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  🚀 WP Rocket
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{site.url}</p>
          </div>
        </div>
        <span className="pointer-events-auto relative z-30 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">
          View Report →
        </span>
      </div>

      {/* Body: 2-column grid on md+, stacks on mobile */}
      <div className="relative z-20 pointer-events-none grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-800">
        {/* Left: Scores + Vitals + Counts */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">📱 Mobile</p>
            {mobile ? (
              <div className="grid grid-cols-4 gap-2">
                <ScoreCell label="Perf" value={mobile.performance} delta={perfDelta} />
                <ScoreCell label="A11y" value={mobile.accessibility} delta={a11yDelta} />
                <ScoreCell label="BP" value={mobile.best_practices} delta={bpDelta} />
                <ScoreCell label="SEO" value={mobile.seo} delta={seoDelta} />
              </div>
            ) : (
              <p className="text-xs text-gray-600">No mobile scan yet</p>
            )}
          </div>

          {primary && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Core Vitals</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <VitalLine label="LCP" value={primary.lcp} />
                <VitalLine label="FCP" value={primary.fcp} />
                <VitalLine label="TBT" value={primary.tbt} />
                <VitalLine label="CLS" value={primary.cls} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {criticalCount > 0 && (
              <Badge color="red">🔴 {criticalCount} critical</Badge>
            )}
            {improvementCount > 0 && (
              <Badge color="yellow">🟡 {improvementCount} to improve</Badge>
            )}
            {optionalCount > 0 && (
              <Badge color="green-dim">🟢 {optionalCount} optional</Badge>
            )}
            {criticalCount === 0 && improvementCount === 0 && (
              <Badge color="green">✅ All passing</Badge>
            )}
          </div>
        </div>

        {/* Right: Trend Chart */}
        <div className="p-5 min-w-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            14-day trend ({history.length} scan{history.length !== 1 ? 's' : ''})
          </p>
          {history.length >= 2 ? (
            <div className="h-[180px] pointer-events-auto relative z-30">
              <TrendMini data={history} />
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg">
              {history.length === 0 ? 'Not enough data for a trend yet' : 'Only 1 scan — need more to draw a trend'}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-20 pointer-events-none px-5 py-3 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-3 flex-wrap">
          {renderDeltaSummary(perfDelta, a11yDelta, bpDelta, seoDelta)}
        </div>
        <span>{primary?.scanned_at ? formatRelativeTime(primary.scanned_at) : ''}</span>
      </div>
    </div>
  );
}

function TrendMini({ data }) {
  const chartData = data.map((r) => ({
    date: new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Perf: r.performance,
    A11y: r.accessibility,
    BP: r.best_practices,
    SEO: r.seo,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#6B7280', fontSize: 10 }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#6B7280', fontSize: 10 }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
          width={30}
        />
        <ReferenceLine y={90} stroke="#10B981" strokeDasharray="3 3" strokeOpacity={0.25} />
        <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.25} />
        <Tooltip content={<MiniTooltip />} />
        <Line type="monotone" dataKey="Perf" stroke="#10B981" strokeWidth={2} dot={{ r: 2.5, fill: '#10B981' }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="A11y" stroke="#3B82F6" strokeWidth={1.5} dot={{ r: 2, fill: '#3B82F6' }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="BP" stroke="#8B5CF6" strokeWidth={1.5} dot={{ r: 2, fill: '#8B5CF6' }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="SEO" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 2, fill: '#F59E0B' }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-950 border border-gray-700 rounded-lg p-2 shadow-xl">
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex items-center justify-between gap-3 text-[10px] py-px">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-gray-300">{e.name}</span>
          </span>
          <span className="font-bold" style={{ color: e.color }}>{e.value}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreCell({ label, value, delta }) {
  const color = value >= 90 ? 'text-green-400' : value >= 50 ? 'text-yellow-400' : 'text-red-400';
  const bg = value >= 90 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="text-center">
      <div className="h-1 rounded-full bg-gray-800 mb-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${bg} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`text-lg font-bold ${color}`}>{value}</span>
        {delta !== null && delta !== 0 && (
          <span className={`text-[9px] font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function VitalLine({ label, value }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-medium">{value || '—'}</span>
    </div>
  );
}

function Badge({ color, children }) {
  const classes = {
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    'green-dim': 'bg-gray-800 text-gray-400 border-gray-700',
  }[color] || 'bg-gray-800 text-gray-400 border-gray-700';

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${classes}`}>{children}</span>
  );
}

function renderDeltaSummary(perf, a11y, bp, seo) {
  const deltas = [
    { label: 'perf', value: perf },
    { label: 'a11y', value: a11y },
    { label: 'bp', value: bp },
    { label: 'seo', value: seo },
  ].filter((d) => d.value !== null && d.value !== 0);

  if (deltas.length === 0) {
    return <span>No change since last scan</span>;
  }

  return (
    <>
      <span className="text-gray-600">Δ vs last scan:</span>
      {deltas.map((d) => (
        <span
          key={d.label}
          className={d.value > 0 ? 'text-green-400' : 'text-red-400'}
        >
          {d.value > 0 ? '+' : ''}{d.value} {d.label}
        </span>
      ))}
    </>
  );
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diffMs = new Date() - new Date(dateStr);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
