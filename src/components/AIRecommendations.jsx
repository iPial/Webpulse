'use client';

import { useState, useEffect, useCallback } from 'react';

// Unified AI Recommendations + Fix Tasks card.
// - GET /api/fixes returns rich per-issue rows (title, action, impact,
//   expected_gain, rocket_path, caveats, status, needs_reverify, ...).
// - PATCH /api/fixes toggles status between 'pending' and 'fixed'.
// - Re-analyze triggers POST /api/ai which re-runs both the markdown and
//   the compact JSON prompt — the latter upserts rows into site_fixes.
//   We listen for webpulse:fixes-updated to re-fetch after Analyze.
export default function AIRecommendations({
  siteId,
  isWPRocket = false,
  initialGeneratedAt = null,
}) {
  const [fixes, setFixes] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showFixed, setShowFixed] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/fixes?siteId=${siteId}`);
      if (!res.ok) throw new Error('Failed to load fixes');
      const data = await res.json();
      setFixes(data.fixes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when /api/ai or a scheduled scan populates new fixes
  useEffect(() => {
    function onUpdated(e) {
      if (!e.detail?.siteId || Number(e.detail.siteId) === Number(siteId)) {
        load();
      }
    }
    window.addEventListener('webpulse:fixes-updated', onUpdated);
    return () => window.removeEventListener('webpulse:fixes-updated', onUpdated);
  }, [siteId, load]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || 'Analyze failed');
      setGeneratedAt(data.generatedAt || new Date().toISOString());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function setStatus(id, status) {
    // Optimistic update
    setFixes((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status,
              fixed_at: status === 'fixed' ? new Date().toISOString() : null,
              needs_reverify: false,
            }
          : f
      )
    );

    try {
      const res = await fetch('/api/fixes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  const pending = fixes.filter((f) => f.status === 'pending');
  const needsReverify = fixes.filter((f) => f.status === 'fixed' && f.needs_reverify);
  const fixed = fixes.filter((f) => f.status === 'fixed' && !f.needs_reverify);
  const hasAny = fixes.length > 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">AI Recommendations &amp; Fix Tasks</h3>
          {isWPRocket && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              🚀 WP Rocket tuned
            </span>
          )}
          {generatedAt && (
            <span className="text-[10px] text-gray-500" title={new Date(generatedAt).toLocaleString()}>
              Generated {formatAgo(generatedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasAny && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{pending.length} pending</span>
              {needsReverify.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                  {needsReverify.length} verify
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{fixed.length} fixed</span>
            </div>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? 'Analyzing…' : hasAny ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-3">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {analyzing && (
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
          Analyzing scan results and populating fix tasks…
        </div>
      )}

      {loading && !analyzing && !hasAny ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !hasAny ? (
        <p className="text-sm text-gray-500">
          Click <strong className="text-gray-300">{analyzing ? 'Analyzing' : 'Analyze'}</strong> to get {isWPRocket ? 'WP Rocket-specific' : 'AI-powered'} recommendations.
          Each issue becomes a checkable task you can mark as fixed.
        </p>
      ) : (
        <div className="space-y-4">
          {needsReverify.length > 0 && (
            <FixSection title="Needs re-verify" color="orange" fixes={needsReverify} onSetStatus={setStatus} variant="verify" />
          )}
          {pending.length > 0 && (
            <FixSection title="To do" color="yellow" fixes={pending} onSetStatus={setStatus} />
          )}
          {fixed.length > 0 && (
            <div>
              <button
                onClick={() => setShowFixed(!showFixed)}
                className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 mb-2 inline-flex items-center gap-1"
              >
                Fixed ({fixed.length}) {showFixed ? '▾' : '▸'}
              </button>
              {showFixed && (
                <div className="space-y-2">
                  {fixed.map((f) => (
                    <FixCard key={f.id} fix={f} onSetStatus={setStatus} variant="fixed" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FixSection({ title, color, fixes, onSetStatus, variant }) {
  const colorClass = color === 'orange' ? 'text-orange-400' : color === 'yellow' ? 'text-gray-500' : 'text-gray-500';
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider mb-2 ${colorClass}`}>{title}</p>
      <div className="space-y-2">
        {fixes.map((f) => (
          <FixCard key={f.id} fix={f} onSetStatus={onSetStatus} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function FixCard({ fix, onSetStatus, variant = 'pending' }) {
  const isFixed = fix.status === 'fixed';
  const impact = fix.impact;
  const hasDetails = fix.impact || fix.expected_gain || fix.rocket_path || fix.caveats;

  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-3 ${
        variant === 'verify'
          ? 'bg-orange-500/5 border-orange-500/20'
          : variant === 'fixed'
          ? 'bg-gray-800/40 border-gray-800'
          : 'bg-gray-800/30 border-gray-700'
      }`}
    >
      <button
        onClick={() => onSetStatus(fix.id, isFixed ? 'pending' : 'fixed')}
        title={isFixed ? 'Mark as pending again' : 'Mark as fixed'}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
          isFixed
            ? 'bg-green-500 border-green-500 hover:bg-green-600'
            : 'border-gray-600 hover:border-blue-500 bg-transparent'
        }`}
      >
        {isFixed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className={`text-sm font-semibold flex items-center gap-2 flex-wrap ${isFixed ? 'text-gray-400 line-through' : 'text-white'}`}>
          <span>{fix.title}</span>
          {impact && <ImpactPill impact={impact} muted={isFixed} />}
          {fix.expected_gain && !isFixed && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
              {fix.expected_gain}
            </span>
          )}
          {variant === 'verify' && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
              reappeared after scan
            </span>
          )}
        </div>

        {/* Details */}
        {hasDetails && !isFixed && (
          <div className="mt-2 space-y-1.5 text-xs">
            {fix.rocket_path && (
              <div>
                <span className="text-gray-500">WP Rocket path: </span>
                <code className="px-1.5 py-0.5 rounded bg-gray-950 text-blue-300 font-mono">{fix.rocket_path}</code>
              </div>
            )}
            {fix.action && (
              <div className="text-gray-300">
                <span className="text-gray-500">Action: </span>
                {fix.action}
              </div>
            )}
            {fix.caveats && (
              <div className="text-gray-400">
                <span className="text-gray-500">Caveats: </span>
                {fix.caveats}
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="text-[10px] text-gray-600 mt-2">
          {isFixed && fix.fixed_at ? (
            <>fixed {formatAgo(fix.fixed_at)}</>
          ) : (
            <>first seen {formatAgo(fix.first_seen_at)} · last seen {formatAgo(fix.last_seen_at)}</>
          )}
        </div>
      </div>

      {variant === 'verify' && (
        <button
          onClick={() => onSetStatus(fix.id, 'pending')}
          className="text-[10px] px-2 py-1 rounded border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 transition-colors shrink-0"
        >
          Mark pending
        </button>
      )}
    </div>
  );
}

function ImpactPill({ impact, muted }) {
  const map = {
    High: 'bg-red-500/10 text-red-400',
    Medium: 'bg-yellow-500/10 text-yellow-400',
    Low: 'bg-gray-700 text-gray-400',
  };
  const cls = map[impact] || 'bg-gray-700 text-gray-400';
  return (
    <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${muted ? 'bg-gray-800 text-gray-500' : cls}`}>
      {impact}
    </span>
  );
}

function formatAgo(iso) {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
