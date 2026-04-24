'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Field';

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

const LEVEL_STYLES = {
  info: { pill: 'bg-[#E6EFFF] text-cobalt', stripe: 'bg-cobalt' },
  warn: { pill: 'bg-warn-bg text-[#8A5A00]', stripe: 'bg-warn' },
  error: { pill: 'bg-bad-bg text-bad', stripe: 'bg-bad' },
};

const KIND_STYLES = {
  schedule: 'bg-lime text-lime-ink',
  scan: 'bg-sky text-cobalt',
  ai: 'bg-[#EDE2F8] text-violet',
  notification: 'bg-rose text-orange',
  system: 'bg-paper-2 text-ink-2',
};

const KIND_STRIPE = {
  schedule: 'bg-lime',
  scan: 'bg-cobalt',
  ai: 'bg-violet',
  notification: 'bg-orange',
  system: 'bg-line-2',
};

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
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
      setTimeout(fetchLogs, 500);
    } catch (err) {
      setDiagResult({ error: err.message });
    } finally {
      setDiagLoading(false);
    }
  }

  // Stats derived from current logs
  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.level === 'info' && l.type === 'scan').length,
    warn: logs.filter((l) => l.level === 'warn').length,
    error: logs.filter((l) => l.level === 'error').length,
    ai: logs.filter((l) => l.type === 'ai').length,
  };

  const filteredLogs = search
    ? logs.filter((l) => (l.message || '').toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-[10px]">
        <StatCard label="Events" value={stats.total} />
        <StatCard label="Successful scans" value={stats.success} tone="good" />
        <StatCard label="Warnings" value={stats.warn} tone="warn" />
        <StatCard label="Errors" value={stats.error} tone="bad" />
        <StatCard label="AI calls" value={stats.ai} />
      </div>

      {/* Filter bar */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted">
            Filters
          </span>
          <Tabs
            value={type}
            onChange={setType}
            items={TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          />
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Tabs
              value={level}
              onChange={setLevel}
              items={LEVEL_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            />
            <Input
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px] rounded-r-pill py-[8px] text-[12px]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 text-[12px] text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-line bg-surface text-ink focus:ring-ink"
            />
            Auto-refresh every 10s
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={fetchLogs}>Refresh</Button>
            <Button size="sm" variant="ink" onClick={runDiagnostic} disabled={diagLoading}>
              {diagLoading ? 'Running…' : 'Run diagnostic'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Diagnostic result */}
      {diagResult && (
        <Card variant="violet" className="!text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[15px]">Schedule diagnostic</h3>
            <button
              onClick={() => setDiagResult(null)}
              className="text-white/70 hover:text-white text-[18px] leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[12px] mt-2">
            <Row label="QStash token set" ok={diagResult.qstashToken} />
            <Row label="QStash signing keys" ok={diagResult.qstashSigning} />
            <Row label="QStash URL" value={diagResult.qstashUrl || '—'} />
            <Row
              label={`Base URL (${diagResult.baseUrlSource || 'unknown'})`}
              value={diagResult.baseUrl || '—'}
            />
            <Row
              label="Test fire"
              ok={diagResult.testFire?.ok}
              value={diagResult.testFire?.error || diagResult.testFire?.note || ''}
            />
          </dl>
          {diagResult.testFire?.ok && (
            <p className="text-[12px] mt-3 text-lime">
              ✓ Ping enqueued. Wait ~15s — a &ldquo;Diagnostic ping received&rdquo; entry should
              appear in the feed below.
            </p>
          )}
        </Card>
      )}

      {/* Logs feed */}
      {loading ? (
        <Card variant="hairline" className="text-center py-10">
          <p className="text-[13px] text-muted">Loading logs…</p>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card variant="hairline" className="text-center py-10">
          <p className="text-[13px] text-muted">
            No logs yet. They appear here as scans run, schedules fire, and notifications go out.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {filteredLogs.map((log) => {
            const isOpen = expanded[log.id];
            const lvl = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
            const kindClass = KIND_STYLES[log.type] || KIND_STYLES.system;
            const kindStripe = KIND_STRIPE[log.type] || lvl.stripe || 'bg-line';

            return (
              <div
                key={log.id}
                className="relative bg-surface border border-line rounded-[14px] shadow-1 overflow-hidden"
              >
                <div
                  className={`absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r ${kindStripe}`}
                />
                <button
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [log.id]: !prev[log.id] }))
                  }
                  className={`w-full text-left px-[18px] py-[14px] hover:bg-paper/40 transition-colors ${
                    isOpen ? 'bg-paper-2/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="font-mono text-[11px] text-muted shrink-0 min-w-[90px]"
                      title={new Date(log.created_at).toLocaleString()}
                    >
                      {formatRelative(log.created_at)}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-[10px] py-[3px] rounded-r-pill ${kindClass}`}
                    >
                      ● {log.type}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-[0.06em] font-semibold px-[10px] py-[3px] rounded-r-pill ${lvl.pill}`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[13px] text-ink-2 flex-1 min-w-0 truncate">
                      {log.message}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-[18px] pb-[14px] pt-1 text-[12px] text-muted">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.08em] font-semibold">
                      Metadata
                    </div>
                    <pre className="rounded-r-sm bg-paper-2 border border-line p-3 text-[11px] text-ink-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                      {JSON.stringify(log.metadata || {}, null, 2)}
                    </pre>
                    <div className="mt-2 text-[10px] text-muted">
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

function StatCard({ label, value, tone }) {
  const toneClass =
    tone === 'good'
      ? 'text-good'
      : tone === 'warn'
      ? 'text-warn'
      : tone === 'bad'
      ? 'text-bad'
      : 'text-ink';
  return (
    <Card padding="sm" className="!p-[16px_18px]">
      <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
        {label}
      </div>
      <div className={`font-serif text-[34px] leading-none tracking-tight mt-1 ${toneClass}`}>
        {value}
      </div>
    </Card>
  );
}

function Row({ label, ok, value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-white/70">{label}</span>
      <span
        className={`font-medium truncate ${
          ok === true ? 'text-lime' : ok === false ? 'text-orange' : 'text-white'
        }`}
      >
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
