'use client';

import { useState } from 'react';
import ScoreRing from './ScoreRing';
import VitalsPanel from './VitalsPanel';
import AuditList from './AuditList';

export default function StrategyTabs({ mobile, desktop }) {
  const [strategy, setStrategy] = useState(mobile ? 'mobile' : 'desktop');
  const result = strategy === 'mobile' ? mobile : desktop;

  return (
    <div>
      {/* Strategy tabs + comparison */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
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

        {/* Quick comparison */}
        {mobile && desktop && (
          <div className="hidden md:flex items-center gap-4 text-xs">
            <CompareChip label="Mobile" value={mobile.performance} />
            <span className="text-gray-600">vs</span>
            <CompareChip label="Desktop" value={desktop.performance} />
            <DeltaBadge delta={desktop.performance - mobile.performance} />
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Score rings + summary */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-around mb-4">
              <ScoreRing score={result.performance} size={96} strokeWidth={6} label="Performance" />
              <ScoreRing score={result.accessibility} size={96} strokeWidth={6} label="Accessibility" />
              <ScoreRing score={result.best_practices} size={96} strokeWidth={6} label="Best Practices" />
              <ScoreRing score={result.seo} size={96} strokeWidth={6} label="SEO" />
            </div>

            {/* Score summary text */}
            <div className="text-center mt-2">
              <ScoreSummary result={result} />
            </div>
          </div>

          {/* Vitals + Audits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <VitalsPanel result={result} />
            </div>
            <div className="lg:col-span-2">
              <AuditList audits={result.audits} />
            </div>
          </div>

          {/* Scan timestamp */}
          <p className="text-xs text-gray-500">
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
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CompareChip({ label, value }) {
  const color = value >= 90 ? 'text-score-good' : value >= 50 ? 'text-score-average' : 'text-score-poor';
  return (
    <span className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </span>
  );
}

function DeltaBadge({ delta }) {
  if (delta === 0) return null;
  const isPositive = delta > 0;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
      isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    }`}>
      Desktop {isPositive ? '+' : ''}{delta}
    </span>
  );
}

function ScoreSummary({ result }) {
  const audits = result.audits || {};
  const critical = audits.critical?.length || 0;
  const improvement = audits.improvement?.length || 0;

  if (critical === 0 && improvement === 0) {
    return <p className="text-xs text-green-400">All audits passing. Great job!</p>;
  }

  const parts = [];
  if (critical > 0) parts.push(`${critical} critical issue${critical !== 1 ? 's' : ''}`);
  if (improvement > 0) parts.push(`${improvement} improvement${improvement !== 1 ? 's' : ''}`);

  return (
    <p className="text-xs text-gray-400">
      Found {parts.join(' and ')} that need attention.
    </p>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  );
}
