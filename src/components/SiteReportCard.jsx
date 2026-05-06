'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';
import Logo from '@/components/ui/Logo';
import LineChart from '@/components/ui/charts/LineChart';

// Per-site overview card. Mobile/Desktop toggle swaps both the scores
// section AND the trend chart on the right — they always reflect the
// same strategy. Kept as a single client component because the toggle
// state has to drive multiple sibling sections inside the card.
export default function SiteReportCard({ site, mobile, desktop, prevMobile, prevDesktop, history = [] }) {
  if (!mobile && !desktop) return null;

  // Default the toggle to whichever strategy actually has data. Most sites
  // have both; brand-new sites might be mobile-only or desktop-only.
  const initialStrategy = mobile ? 'mobile' : 'desktop';
  const [strategy, setStrategy] = useState(initialStrategy);

  const result = strategy === 'mobile' ? mobile : desktop;
  const prev = strategy === 'mobile' ? prevMobile : prevDesktop;
  const audits = result?.audits || (mobile?.audits || desktop?.audits || {});
  const criticalCount = audits.critical?.length || 0;
  const improvementCount = audits.improvement?.length || 0;
  const optionalCount = audits.optional?.length || 0;

  const perfDelta = result && prev ? result.performance - prev.performance : null;
  const a11yDelta = result && prev ? result.accessibility - prev.accessibility : null;
  const bpDelta = result && prev ? result.best_practices - prev.best_practices : null;
  const seoDelta = result && prev ? result.seo - prev.seo : null;

  const hasWPRocket = site.tags?.includes('wp-rocket');

  // Filter history rows to the selected strategy. The Overview page now
  // ships rows for both strategies; we pick one here so the trend matches
  // the scores above. Sort ascending so the line draws left-to-right in time.
  const filtered = (history || [])
    .filter((r) => r.strategy === strategy)
    .sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at));
  const labels = filtered.map((r) =>
    new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );
  const series = [
    { name: 'Perf', color: '#FF5C35', points: filtered.map((r) => r.performance ?? 0) },
    { name: 'A11y', color: '#F59E0B', points: filtered.map((r) => r.accessibility ?? 0) },
    { name: 'BP', color: '#0EA86B', points: filtered.map((r) => r.best_practices ?? 0) },
    { name: 'SEO', color: '#7B5CFF', points: filtered.map((r) => r.seo ?? 0) },
  ];

  return (
    <Card className="relative overflow-hidden !p-0">
      <Link
        href={`/site/${site.id}`}
        className="absolute inset-0 z-10"
        aria-label={`View ${site.name} report`}
      />

      {/* Header */}
      <div className="relative z-20 pointer-events-none px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-line">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Logo site={site} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[16px] text-ink truncate">{site.name}</h3>
              {hasWPRocket && (
                <Pill variant="default" className="!bg-violet/10 !text-violet !border-violet/20">
                  🚀 WP Rocket
                </Pill>
              )}
            </div>
            <p className="text-[12px] text-muted truncate mt-0.5">{site.url}</p>
          </div>
        </div>
        <span className="pointer-events-auto relative z-30 inline-flex items-center gap-1 text-[12px] text-cobalt hover:underline whitespace-nowrap">
          View report →
        </span>
      </div>

      {/* Strategy toggle — drives scores AND trend chart together */}
      <div className="relative z-30 px-5 pt-4 flex items-center justify-between gap-3 flex-wrap">
        <StrategyToggle
          strategy={strategy}
          onChange={setStrategy}
          mobileAvailable={!!mobile}
          desktopAvailable={!!desktop}
        />
        {mobile && desktop && (
          <span className="text-[11px] text-muted">
            <span className="font-medium text-ink-2">📱 {mobile.performance}</span>
            {' vs '}
            <span className="font-medium text-ink-2">🖥️ {desktop.performance}</span>
            {desktop.performance !== mobile.performance && (
              <span
                className={`ml-1 font-semibold ${
                  desktop.performance > mobile.performance ? 'text-good' : 'text-bad'
                }`}
              >
                ({desktop.performance > mobile.performance ? '+' : ''}
                {desktop.performance - mobile.performance})
              </span>
            )}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative z-20 pointer-events-none grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr] divide-y md:divide-y-0 md:divide-x divide-line">
        <div className="p-5 space-y-4">
          {/* Scores for the selected strategy */}
          <div>
            {result ? (
              <div className="grid grid-cols-4 gap-2">
                <ScoreCell label="Perf" value={result.performance} delta={perfDelta} />
                <ScoreCell label="A11y" value={result.accessibility} delta={a11yDelta} />
                <ScoreCell label="BP" value={result.best_practices} delta={bpDelta} />
                <ScoreCell label="SEO" value={result.seo} delta={seoDelta} />
              </div>
            ) : (
              <p className="text-[12px] text-muted">
                No {strategy} scan yet — switch to{' '}
                {strategy === 'mobile' ? 'desktop' : 'mobile'}.
              </p>
            )}
          </div>

          {result && (
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
                Core Vitals
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <VitalLine label="LCP" value={result.lcp} />
                <VitalLine label="FCP" value={result.fcp} />
                <VitalLine label="TBT" value={result.tbt} />
                <VitalLine label="CLS" value={result.cls} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {criticalCount > 0 && <Pill variant="bad">🔴 {criticalCount} critical</Pill>}
            {improvementCount > 0 && <Pill variant="warn">🟡 {improvementCount} to improve</Pill>}
            {optionalCount > 0 && <Pill>🟢 {optionalCount} optional</Pill>}
            {criticalCount === 0 && improvementCount === 0 && (
              <Pill variant="good">✅ All passing</Pill>
            )}
          </div>
        </div>

        {/* Right: trend matching the toggled strategy */}
        <div className="p-5 min-w-0">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">
            14-day trend · {strategy} ({filtered.length} scan{filtered.length !== 1 ? 's' : ''})
          </p>
          {filtered.length >= 2 ? (
            <div className="relative">
              <LineChart series={series} labels={labels} min={0} max={105} height={180} />
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-[12px] text-muted border border-dashed border-line rounded-r-sm">
              {filtered.length === 0
                ? `Not enough ${strategy} data for a trend yet`
                : `Only 1 ${strategy} scan — need more to draw a trend`}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-20 pointer-events-none px-5 py-3 border-t border-line flex items-center justify-between text-[11px] text-muted flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {renderDeltaSummary(perfDelta, a11yDelta, bpDelta, seoDelta, strategy)}
        </div>
        <span>{result?.scanned_at ? formatRelativeTime(result.scanned_at) : ''}</span>
      </div>
    </Card>
  );
}

function StrategyToggle({ strategy, onChange, mobileAvailable, desktopAvailable }) {
  const baseBtn =
    'inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-r-pill text-[12px] font-semibold transition-colors';
  const active = 'bg-ink text-surface shadow-ink';
  const inactive = 'text-ink-2 hover:bg-paper-2';
  const disabled = 'text-muted/50 cursor-not-allowed';

  return (
    <div className="pointer-events-auto relative z-30 inline-flex gap-[2px] p-[3px] bg-surface border border-line rounded-r-pill shadow-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (mobileAvailable) onChange('mobile'); }}
        disabled={!mobileAvailable}
        className={`${baseBtn} ${strategy === 'mobile' ? active : mobileAvailable ? inactive : disabled}`}
        title={mobileAvailable ? 'Show mobile scores + trend' : 'No mobile scan yet'}
      >
        <PhoneIcon /> Mobile
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (desktopAvailable) onChange('desktop'); }}
        disabled={!desktopAvailable}
        className={`${baseBtn} ${strategy === 'desktop' ? active : desktopAvailable ? inactive : disabled}`}
        title={desktopAvailable ? 'Show desktop scores + trend' : 'No desktop scan yet'}
      >
        <DesktopIcon /> Desktop
      </button>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  );
}

function ScoreCell({ label, value, delta }) {
  const color =
    value >= 90 ? 'text-good' : value >= 50 ? 'text-warn' : 'text-bad';
  const bg =
    value >= 90 ? 'bg-good' : value >= 50 ? 'bg-warn' : 'bg-bad';

  return (
    <div className="text-center">
      <div className="h-[4px] rounded-full bg-paper-2 mb-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${bg} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`font-serif text-[22px] leading-none ${color}`}>{value}</span>
        {delta !== null && delta !== 0 && (
          <span
            className={`text-[10px] font-semibold ${delta > 0 ? 'text-good' : 'text-bad'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function VitalLine({ label, value }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink-2 font-mono font-medium">{value || '—'}</span>
    </div>
  );
}

function renderDeltaSummary(perf, a11y, bp, seo, strategy) {
  const deltas = [
    { label: 'perf', value: perf },
    { label: 'a11y', value: a11y },
    { label: 'bp', value: bp },
    { label: 'seo', value: seo },
  ].filter((d) => d.value !== null && d.value !== 0);

  if (deltas.length === 0) return <span>No change since last {strategy} scan</span>;

  return (
    <>
      <span className="text-muted">Δ vs last {strategy} scan:</span>
      {deltas.map((d) => (
        <span key={d.label} className={d.value > 0 ? 'text-good font-medium' : 'text-bad font-medium'}>
          {d.value > 0 ? '+' : ''}
          {d.value} {d.label}
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
