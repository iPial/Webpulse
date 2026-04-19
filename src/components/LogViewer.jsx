'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'scan', label: 'Scan' },
  { value: 'notification', label: 'Notification' },
  { value: 'ai', label: 'AI' },
  { value: 'system', label: 'System' },
];

const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
];

const LEVEL_COLOR = {
  info: { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/5' },
  warn: { dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/5' },
  error: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/5' },
};

const TYPE_BADGE = {
  schedule: 'bg-blue-500/10 text-blue-400',
  scan: 'bg-green-500/10 text-green-400',
  notification: 'bg-purple-500/10 text-purple-400',
  ai: 'bg-pink-500/10 text-pink-400',
  system: 'bg-gray-700 text-gray-300',
};

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [diagResult, setDiagResult] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const timerRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (type !== 'all') qs.set('type', type);
      if (level !== 'all') qs.set('level', level);
      qs.set('limit', '150');
      const res = await fetch(`/api/logs?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [type, level]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(fetchLogs, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  async function runDiagnostic() {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const res = await fetch('/api/schedules/diagnostic', { method: 'POST' });
      const data = await res.json();
      setDiagResult(data);
      // Refresh the log feed to catch the new entries
      setTimeout(fetchLogs, 500);
    } catch (err) {
      setDiagResult({ error: err.message });
    } finally {
      setDiagLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="text-xs rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="text-xs rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={fetchLogs}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Refresh
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            Auto-refresh (10s)
          </label>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={diagLoading}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {diagLoading ? 'Running…' : 'Run Diagnostic'}
        </button>
      </div>

      {/* Diagnostic output */}
      {diagResult && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-purple-300">Schedule Diagnostic</h3>
            <button onClick={() => setDiagResult(null)} className="text-xs text-gray-500 hover:text-white">×</button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Row label="QStash token set" ok={diagResult.qstashToken} />
            <Row label="QStash signing keys" ok={diagResult.qstashSigning} />
            <Row label={`Base URL (${diagResult.baseUrlSource || 'unknown'})`} value={diagResult.baseUrl || '—'} />
            <Row
              label="Test fire"
              ok={diagResult.testFire?.ok}
              value={diagResult.testFire?.error || diagResult.testFire?.note || ''}
            />
          </dl>
          {diagResult.testFire?.ok && (
            <p className="text-xs text-green-400 mt-3">
              ✓ Ping enqueued. Wait ~15 seconds — a &quot;Diagnostic ping received&quot; entry should appear in the feed below.
            </p>
          )}
        </div>
      )}

      {/* Logs feed */}
      {loading ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
          Loading logs…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
          No logs yet. They appear here as scans run, schedules fire, and notifications go out.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {logs.map((log) => {
            const isOpen = expanded[log.id];
            const lc = LEVEL_COLOR[log.level] || LEVEL_COLOR.info;
            return (
              <div key={log.id} className="border-b border-gray-800/50 last:border-0">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [log.id]: !prev[log.id] }))}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800/30 transition-colors ${isOpen ? 'bg-gray-800/30' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold ${lc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${lc.dot}`} />
                      {log.level}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_BADGE[log.type] || 'bg-gray-800 text-gray-400'}`}>
                      {log.type}
                    </span>
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                      {log.message}
                    </span>
                    <span className="text-[10px] text-gray-500 shrink-0" title={new Date(log.created_at).toLocaleString()}>
                      {formatRelative(log.created_at)}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 text-xs text-gray-400">
                    <div className="mb-1 text-[10px] text-gray-500">Metadata:</div>
                    <pre className="rounded bg-gray-950 p-3 text-[11px] text-gray-300 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(log.metadata || {}, null, 2)}
                    </pre>
                    <div className="mt-2 text-[10px] text-gray-600">
                      {new Date(log.created_at).toLocaleString()} · id={log.id}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, ok, value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-gray-300'} truncate`}>
        {ok === true ? '✓' : ok === false ? '✗' : ''} {value || ''}
      </span>
    </div>
  );
}

function formatRelative(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
