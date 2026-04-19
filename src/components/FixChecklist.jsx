'use client';

import { useState, useEffect, useCallback } from 'react';

export default function FixChecklist({ siteId }) {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFixed, setShowFixed] = useState(false);
  const [error, setError] = useState(null);

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

  // Re-fetch whenever /api/ai populates new fixes for this site
  useEffect(() => {
    function onFixesUpdated(e) {
      if (!e.detail?.siteId || Number(e.detail.siteId) === Number(siteId)) {
        load();
      }
    }
    window.addEventListener('webpulse:fixes-updated', onFixesUpdated);
    return () => window.removeEventListener('webpulse:fixes-updated', onFixesUpdated);
  }, [siteId, load]);

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
      load(); // Revert on failure
    }
  }

  const pending = fixes.filter((f) => f.status === 'pending');
  const needsReverify = fixes.filter((f) => f.status === 'fixed' && f.needs_reverify);
  const fixed = fixes.filter((f) => f.status === 'fixed' && !f.needs_reverify);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">AI Fix Tasks</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{pending.length} pending</span>
          {needsReverify.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
              {needsReverify.length} needs re-verify
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{fixed.length} fixed</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : fixes.length === 0 ? (
        <p className="text-sm text-gray-500">
          No fix tasks yet. Run <strong className="text-gray-300">Analyze</strong> above — the AI&apos;s top fixes show up here as checkable tasks. They&apos;re also populated automatically when a scheduled scan runs with AI on.
        </p>
      ) : (
        <div className="space-y-3">
          {needsReverify.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-orange-400 mb-2">Needs re-verify</p>
              <div className="space-y-2">
                {needsReverify.map((f) => (
                  <FixRow key={f.id} fix={f} onSetStatus={setStatus} variant="verify" />
                ))}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Pending</p>
              <div className="space-y-2">
                {pending.map((f) => (
                  <FixRow key={f.id} fix={f} onSetStatus={setStatus} />
                ))}
              </div>
            </div>
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
                    <FixRow key={f.id} fix={f} onSetStatus={setStatus} variant="fixed" />
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

function FixRow({ fix, onSetStatus, variant = 'pending' }) {
  const isFixed = fix.status === 'fixed';
  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-3 ${
        variant === 'verify'
          ? 'bg-orange-500/5 border-orange-500/20'
          : variant === 'fixed'
          ? 'bg-gray-800/50 border-gray-800'
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
        <div className={`text-sm font-medium ${isFixed ? 'text-gray-400 line-through' : 'text-white'}`}>
          {fix.title}
          {variant === 'verify' && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
              reappeared after scan
            </span>
          )}
        </div>
        {fix.action && (
          <div className={`text-xs mt-1 ${isFixed ? 'text-gray-500' : 'text-gray-400'}`}>{fix.action}</div>
        )}
        <div className="text-[10px] text-gray-600 mt-1.5">
          first seen {formatRelative(fix.first_seen_at)} · last seen {formatRelative(fix.last_seen_at)}
          {fix.fixed_at && isFixed && <> · fixed {formatRelative(fix.fixed_at)}</>}
        </div>
      </div>

      {variant === 'verify' && (
        <button
          onClick={() => onSetStatus(fix.id, 'pending')}
          className="text-[10px] px-2 py-1 rounded border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 transition-colors shrink-0"
        >
          Mark pending again
        </button>
      )}
    </div>
  );
}

function formatRelative(dateStr) {
  if (!dateStr) return 'unknown';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
