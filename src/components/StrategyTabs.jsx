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
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {mobile && (
          <TabButton
            active={strategy === 'mobile'}
            onClick={() => setStrategy('mobile')}
            label="Mobile"
          />
        )}
        {desktop && (
          <TabButton
            active={strategy === 'desktop'}
            onClick={() => setStrategy('desktop')}
            label="Desktop"
          />
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Score rings */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-around">
              <ScoreRing score={result.performance} size={96} strokeWidth={6} label="Performance" />
              <ScoreRing score={result.accessibility} size={96} strokeWidth={6} label="Accessibility" />
              <ScoreRing score={result.best_practices} size={96} strokeWidth={6} label="Best Practices" />
              <ScoreRing score={result.seo} size={96} strokeWidth={6} label="SEO" />
            </div>
          </div>

          {/* Vitals + Audits side by side */}
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

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
