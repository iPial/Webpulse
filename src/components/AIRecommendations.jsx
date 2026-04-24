'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';

// AI Recommendations card — shows the full rich markdown analysis from the
// last Analyze run PLUS a compact checkable fix-task list below it.
export default function AIRecommendations({
  siteId,
  isWPRocket = false,
  initialMarkdown = null,
  initialGeneratedAt = null,
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [fixes, setFixes] = useState([]);
  const [loadingFixes, setLoadingFixes] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showFixed, setShowFixed] = useState(false);

  const loadFixes = useCallback(async () => {
    try {
      setLoadingFixes(true);
      const res = await fetch(`/api/fixes?siteId=${siteId}`);
      if (!res.ok) return;
      const data = await res.json();
      setFixes(data.fixes || []);
    } finally {
      setLoadingFixes(false);
    }
  }, [siteId]);

  useEffect(() => {
    loadFixes();
  }, [loadFixes]);

  useEffect(() => {
    function onUpdated(e) {
      if (!e.detail?.siteId || Number(e.detail.siteId) === Number(siteId)) {
        loadFixes();
      }
    }
    window.addEventListener('webpulse:fixes-updated', onUpdated);
    return () => window.removeEventListener('webpulse:fixes-updated', onUpdated);
  }, [siteId, loadFixes]);

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

      if (data.recommendations) setMarkdown(data.recommendations);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
      await loadFixes();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function setStatus(id, status) {
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
      loadFixes();
    }
  }

  const pending = fixes.filter((f) => f.status === 'pending');
  const needsReverify = fixes.filter((f) => f.status === 'fixed' && f.needs_reverify);
  const fixed = fixes.filter((f) => f.status === 'fixed' && !f.needs_reverify);

  return (
    <Card variant="lime">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="w-[28px] h-[28px] rounded-r-sm bg-ink text-lime grid place-items-center"
            aria-hidden="true"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </span>
          <h3 className="font-semibold text-[15px] text-lime-ink">AI Recommendations</h3>
          {isWPRocket && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-r-pill bg-ink text-lime border border-transparent"
            >
              🚀 WP Rocket tuned
            </span>
          )}
          {generatedAt && (
            <span className="text-[11px]" style={{ color: '#364503' }} title={new Date(generatedAt).toLocaleString()}>
              Generated {formatAgo(generatedAt)}
            </span>
          )}
        </div>

        <Button variant="ink" onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? 'Analyzing…' : markdown ? 'Re-analyze' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <div className="rounded-r-sm bg-bad-bg border border-bad/30 p-3 text-[13px] text-bad mt-3">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {analyzing && !markdown && (
        <div className="flex items-center gap-2 text-[13px] mt-3" style={{ color: '#364503' }}>
          <div className="w-4 h-4 border-2 border-lime-ink/30 border-t-lime-ink rounded-full animate-spin" />
          Analyzing scan results…
        </div>
      )}

      {markdown ? (
        <div className="text-[13px] text-lime-ink leading-relaxed mt-3">
          <MarkdownBlock text={markdown} />
        </div>
      ) : !analyzing ? (
        <p className="text-[13px] mt-3" style={{ color: '#364503' }}>
          Click <strong className="font-semibold">Analyze</strong> to get{' '}
          {isWPRocket ? 'WP Rocket-specific' : 'AI-powered'} recommendations.
          {!isWPRocket &&
            ' Tag this site as WP Rocket in Settings for more precise fix instructions.'}
        </p>
      ) : null}

      {/* Fix tracker */}
      {(fixes.length > 0 || loadingFixes) && (
        <div className="mt-6 pt-5 border-t border-lime-deep">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-semibold text-[14px] text-lime-ink inline-flex items-center gap-2">
              ✅ Fix tasks
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Pill variant="warn">{pending.length} pending</Pill>
              {needsReverify.length > 0 && (
                <span className="inline-flex items-center gap-[4px] text-[11px] font-semibold px-[10px] py-[3px] rounded-r-pill bg-orange/15 text-orange border border-orange/30">
                  {needsReverify.length} verify
                </span>
              )}
              <Pill variant="good">{fixed.length} fixed</Pill>
            </div>
          </div>

          {loadingFixes ? (
            <p className="text-[12px]" style={{ color: '#364503' }}>Loading fix tasks…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {needsReverify.length > 0 && (
                <FixSection
                  title="Needs re-verify"
                  tone="orange"
                  fixes={needsReverify}
                  onSetStatus={setStatus}
                  variant="verify"
                />
              )}
              {pending.length > 0 && (
                <FixSection
                  title="Pending"
                  tone="pending"
                  fixes={pending}
                  onSetStatus={setStatus}
                />
              )}
              {fixed.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFixed(!showFixed)}
                    className="text-[11px] uppercase tracking-[0.08em] font-semibold hover:opacity-80 mb-2 inline-flex items-center gap-1"
                    style={{ color: '#364503' }}
                  >
                    Fixed ({fixed.length}) {showFixed ? '▾' : '▸'}
                  </button>
                  {showFixed && (
                    <div className="flex flex-col gap-2">
                      {fixed.map((f) => (
                        <FixRow key={f.id} fix={f} onSetStatus={setStatus} variant="fixed" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: '#364503' }}>
            One row per numbered item above. Tick each off as you apply the fix.
          </p>
        </div>
      )}
    </Card>
  );
}

function FixSection({ title, tone, fixes, onSetStatus, variant }) {
  const colorClass = tone === 'orange' ? 'text-orange' : 'text-lime-ink';
  return (
    <div>
      <p className={`text-[11px] uppercase tracking-[0.1em] font-semibold mb-1.5 ${colorClass}`}>
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {fixes.map((f) => (
          <FixRow key={f.id} fix={f} onSetStatus={onSetStatus} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function FixRow({ fix, onSetStatus, variant = 'pending' }) {
  const isFixed = fix.status === 'fixed';

  const impactMap = {
    High: 'bg-bad-bg text-bad',
    Medium: 'bg-warn-bg text-warn',
    Low: 'bg-paper-2 text-ink-2',
  };
  const impactClass = impactMap[fix.impact] || '';

  const rowBg =
    variant === 'verify'
      ? 'bg-orange/10 border-orange/30'
      : variant === 'fixed'
      ? 'bg-lime-deep/10 border-lime-deep/40'
      : 'bg-surface/70 border-lime-deep/40';

  return (
    <div className={`rounded-r-sm border px-3 py-2.5 flex items-start gap-3 ${rowBg}`}>
      <button
        type="button"
        onClick={() => onSetStatus(fix.id, isFixed ? 'pending' : 'fixed')}
        title={isFixed ? 'Mark as pending again' : 'Mark as fixed'}
        className={`mt-0.5 w-[18px] h-[18px] rounded-[4px] border-2 shrink-0 flex items-center justify-center transition-colors ${
          isFixed
            ? 'bg-good border-good hover:brightness-110'
            : 'border-muted hover:border-ink bg-transparent'
        }`}
      >
        {isFixed && (
          <svg className="w-2.5 h-2.5 text-surface" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-medium flex items-center gap-2 flex-wrap ${
            isFixed ? 'text-muted line-through' : 'text-ink'
          }`}
        >
          <span>{fix.title}</span>
          {fix.impact && !isFixed && (
            <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${impactClass}`}>
              {fix.impact}
            </span>
          )}
          {fix.expected_gain && !isFixed && (
            <span className="text-[10px] font-normal text-cobalt">{fix.expected_gain}</span>
          )}
          {variant === 'verify' && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-orange/20 text-orange">
              reappeared
            </span>
          )}
        </div>
        {fix.rocket_path && !isFixed && (
          <div className="text-[11px] text-cobalt font-mono mt-0.5 truncate" title={fix.rocket_path}>
            {fix.rocket_path}
          </div>
        )}
        {isFixed && fix.fixed_at && (
          <div className="text-[10px] text-muted mt-0.5">fixed {formatAgo(fix.fixed_at)}</div>
        )}
      </div>

      {variant === 'verify' && (
        <button
          type="button"
          onClick={() => onSetStatus(fix.id, 'pending')}
          className="text-[10px] px-2 py-1 rounded-r-pill border border-orange/40 text-orange hover:bg-orange/10 transition-colors shrink-0"
        >
          Mark pending
        </button>
      )}
    </div>
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

// Minimal markdown renderer — same logic as before, redesigned colors
function MarkdownBlock({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let listBuffer = [];
  let paraBuffer = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={`ul-${key++}`} className="list-disc list-outside pl-5 space-y-1 my-2 text-lime-ink">
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  }

  function flushPara() {
    if (paraBuffer.length > 0) {
      const joined = paraBuffer.join(' ');
      nodes.push(
        <p key={`p-${key++}`} className="my-2 text-lime-ink">
          {renderInline(joined, `p-${key}`)}
        </p>
      );
      paraBuffer = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') {
      flushList();
      flushPara();
      continue;
    }

    const h = /^(#{1,3})\s+(.+)/.exec(line);
    if (h) {
      flushList();
      flushPara();
      const level = h[1].length;
      const cls =
        level === 1
          ? 'font-serif text-[22px] leading-tight text-ink mt-5 mb-2'
          : level === 2
          ? 'font-semibold text-[16px] text-ink mt-4 mb-2'
          : 'font-semibold text-[14px] text-ink mt-4 mb-1.5';
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      nodes.push(
        <Tag key={`h-${key++}`} className={cls}>
          {renderInline(h[2], `h-${key}`)}
        </Tag>
      );
      continue;
    }

    const li = /^\s*[-*]\s+(.+)/.exec(line);
    if (li) {
      flushPara();
      listBuffer.push(li[1]);
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      flushList();
      flushPara();
      nodes.push(<hr key={`hr-${key++}`} className="my-4 border-lime-deep" />);
      continue;
    }

    flushList();
    paraBuffer.push(line);
  }

  flushList();
  flushPara();

  return <div>{nodes}</div>;
}

function renderInline(text, keyBase) {
  const tokens = [];
  let buffer = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          if (buffer) { tokens.push({ type: 'text', value: buffer }); buffer = ''; }
          tokens.push({
            type: 'link',
            value: text.slice(i + 1, closeBracket),
            href: text.slice(closeBracket + 2, closeParen),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }
    if (text[i] === '*' && text[i + 1] === '*') {
      if (buffer) { tokens.push({ type: 'text', value: buffer }); buffer = ''; }
      const end = text.indexOf('**', i + 2);
      if (end === -1) { buffer += text.slice(i); i = text.length; }
      else { tokens.push({ type: 'bold', value: text.slice(i + 2, end) }); i = end + 2; }
    } else if (text[i] === '`') {
      if (buffer) { tokens.push({ type: 'text', value: buffer }); buffer = ''; }
      const end = text.indexOf('`', i + 1);
      if (end === -1) { buffer += text.slice(i); i = text.length; }
      else { tokens.push({ type: 'code', value: text.slice(i + 1, end) }); i = end + 1; }
    } else {
      buffer += text[i];
      i++;
    }
  }
  if (buffer) tokens.push({ type: 'text', value: buffer });

  return tokens.map((tok, idx) => {
    const k = `${keyBase}-${idx}`;
    if (tok.type === 'bold') return <strong key={k} className="font-semibold text-ink">{tok.value}</strong>;
    if (tok.type === 'code') return (
      <code key={k} className="px-1.5 py-0.5 rounded bg-ink text-lime text-[11px] font-mono">{tok.value}</code>
    );
    if (tok.type === 'link') return (
      <a key={k} href={tok.href} target="_blank" rel="noopener noreferrer" className="text-cobalt hover:underline underline-offset-2">{tok.value}</a>
    );
    return <span key={k}>{tok.value}</span>;
  });
}
