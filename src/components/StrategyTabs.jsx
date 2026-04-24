'use client';

import { useState } from 'react';
import ScoreRing from '@/components/ui/ScoreRing';
import VitalsPanel from './VitalsPanel';
import AuditList from './AuditList';
import Card from '@/components/ui/Card';

export default function StrategyTabs({ mobile, desktop }) {
  const [strategy, setStrategy] = useState(mobile ? 'mobile' : 'desktop');
  const result = strategy === 'mobile' ? mobile : desktop;

  return (
    <div className="flex flex-col gap-6">
      {/* Strategy toggle + comparison */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex gap-[2px] p-[3px] bg-surface border border-line rounded-r-pill shadow-1">
          {mobile && (
            <TabButton
              active={strategy === 'mobile'}
              onClick={() => setStrategy('mobile')}
              label="Mobile"
              icon={<PhoneIcon />}
            />
          )}
          {desktop && (
            <TabButton
              active={strategy === 'desktop'}
              onClick={() => setStrategy('desktop')}
              label="Desktop"
              icon={<DesktopIcon />}
            />
          )}
        </div>

        {mobile && desktop && (
          <div className="hidden md:flex items-center gap-3 text-[12px]">
            <CompareChip label="Mobile" value={mobile.performance} />
            <span className="text-muted">vs</span>
            <CompareChip label="Desktop" value={desktop.performance} />
            <DeltaBadge delta={desktop.performance - mobile.performance} />
          </div>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-6">
          {/* Score hero */}
          <Card>
            <div className="flex flex-wrap items-center justify-around gap-6 py-4">
              <ScoreRing score={result.performance} size={96} label="Performance" />
              <ScoreRing score={result.accessibility} size={96} label="Accessibility" />
              <ScoreRing score={result.best_practices} size={96} label="Best Practices" />
              <ScoreRing score={result.seo} size={96} label="SEO" />
            </div>
            <div className="text-center mt-2">
              <ScoreSummary result={result} />
            </div>
          </Card>

          {/* Vitals + Audits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <VitalsPanel result={result} />
            </div>
            <div className="lg:col-span-2">
              <AuditList audits={result.audits} />
            </div>
          </div>

          <p className="text-[12px] text-muted">
            Scanned {new Date(result.scanned_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-r-pill text-[13px] font-semibold transition-colors ${
        active ? 'bg-ink text-surface shadow-ink' : 'text-ink-2 hover:bg-paper-2'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CompareChip({ label, value }) {
  const color =
    value >= 90 ? 'text-good' : value >= 50 ? 'text-warn' : 'text-bad';
  return (
    <span className="inline-flex items-center gap-[6px] bg-surface border border-line px-[10px] py-[4px] rounded-r-pill shadow-1">
      <span className="text-muted">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </span>
  );
}

function DeltaBadge({ delta }) {
  if (delta === 0) return null;
  const isPositive = delta > 0;
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-r-pill border ${
        isPositive
          ? 'bg-good-bg text-good border-good/20'
          : 'bg-bad-bg text-bad border-bad/20'
      }`}
    >
      Desktop {isPositive ? '+' : ''}
      {delta}
    </span>
  );
}

function ScoreSummary({ result }) {
  const audits = result.audits || {};
  const critical = audits.critical?.length || 0;
  const improvement = audits.improvement?.length || 0;

  if (critical === 0 && improvement === 0) {
    return <p className="text-[12px] text-good">All audits passing. Great job!</p>;
  }

  const parts = [];
  if (critical > 0) parts.push(`${critical} critical issue${critical !== 1 ? 's' : ''}`);
  if (improvement > 0) parts.push(`${improvement} improvement${improvement !== 1 ? 's' : ''}`);

  return (
    <p className="text-[12px] text-muted">
      Found {parts.join(' and ')} that need attention.
    </p>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  );
}
