'use client';

import { useState, useEffect, useCallback } from 'react';

// AI Recommendations card — shows the full rich markdown analysis from the
// last Analyze run PLUS a compact checkable fix-task list below it.
// - site.ai_markdown holds the full per-issue detail (Impact / WP Rocket
//   path / Action / Caveats) that the user wants back.
// - site_fixes rows are used only for the check-off state tracker below.
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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">AI Recommendations</h3>
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

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing ? 'Analyzing…' : markdown ? 'Re-analyze' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 mb-3">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {analyzing && !markdown && (
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
          Analyzing scan results…
        </div>
      )}

      {/* Rich markdown analysis */}
      {markdown ? (
        <div className="text-sm text-gray-300 leading-relaxed">
          <MarkdownBlock text={markdown} />
        </div>
      ) : !analyzing ? (
        <p className="text-sm text-gray-500">
          Click <strong className="text-gray-300">Analyze</strong> to get {isWPRocket ? 'WP Rocket-specific' : 'AI-powered'} recommendations.
          {!isWPRocket && ' Tag this site as WP Rocket in Settings for more precise fix instructions.'}
        </p>
      ) : null}

      {/* Fix tracker below the markdown */}
      {(fixes.length > 0 || loadingFixes) && (
        <div className="mt-6 pt-5 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              ✅ Fix Tasks
            </h4>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{pending.length} pending</span>
              {needsReverify.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                  {needsReverify.length} verify
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{fixed.length} fixed</span>
            </div>
          </div>

          {loadingFixes ? (
            <p className="text-xs text-gray-500">Loading fix tasks…</p>
          ) : (
            <div className="space-y-3">
              {needsReverify.length > 0 && (
                <FixSection title="Needs re-verify" color="orange" fixes={needsReverify} onSetStatus={setStatus} variant="verify" />
              )}
              {pending.length > 0 && (
                <FixSection title="Pending" color="yellow" fixes={pending} onSetStatus={setStatus} />
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
                    <div className="space-y-1.5">
                      {fixed.map((f) => (
                        <FixRow key={f.id} fix={f} onSetStatus={setStatus} variant="fixed" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-3">
            One row per numbered item above. Tick each off as you apply the fix.
          </p>
        </div>
      )}
    </div>
  );
}

function FixSection({ title, color, fixes, onSetStatus, variant }) {
  const colorClass = color === 'orange' ? 'text-orange-400' : 'text-gray-500';
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${colorClass}`}>{title}</p>
      <div className="space-y-1.5">
        {fixes.map((f) => (
          <FixRow key={f.id} fix={f} onSetStatus={onSetStatus} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function FixRow({ fix, onSetStatus, variant = 'pending' }) {
  const isFixed = fix.status === 'fixed';
  const map = {
    High: 'bg-red-500/10 text-red-400',
    Medium: 'bg-yellow-500/10 text-yellow-400',
    Low: 'bg-gray-700 text-gray-400',
  };
  const impactClass = map[fix.impact] || '';

  return (
    <div
      className={`rounded-lg border px-3 py-2 flex items-start gap-3 ${
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
        className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
          isFixed
            ? 'bg-green-500 border-green-500 hover:bg-green-600'
            : 'border-gray-600 hover:border-blue-500 bg-transparent'
        }`}
      >
        {isFixed && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium flex items-center gap-2 flex-wrap ${isFixed ? 'text-gray-400 line-through' : 'text-white'}`}>
          <span>{fix.title}</span>
          {fix.impact && !isFixed && (
            <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded ${impactClass}`}>
              {fix.impact}
            </span>
          )}
          {fix.expected_gain && !isFixed && (
            <span className="text-[9px] font-normal text-blue-400">{fix.expected_gain}</span>
          )}
          {variant === 'verify' && (
            <span className="text-[9px] font-normal px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
              reappeared
            </span>
          )}
        </div>
        {fix.rocket_path && !isFixed && (
          <div className="text-[10px] text-blue-300 font-mono mt-0.5 truncate" title={fix.rocket_path}>
            {fix.rocket_path}
          </div>
        )}
        {isFixed && fix.fixed_at && (
          <div className="text-[10px] text-gray-600 mt-0.5">fixed {formatAgo(fix.fixed_at)}</div>
        )}
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

// Minimal markdown renderer — headings (#, ##, ###), bold (**…**),
// inline code (`…`), unordered lists, paragraphs, horizontal rules, and
// [text](url) links.
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
        <ul key={`ul-${key++}`} className="list-disc list-outside pl-5 space-y-1 my-2">
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
        <p key={`p-${key++}`} className="my-2 text-gray-300">
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
          ? 'text-lg font-bold text-white mt-5 mb-2'
          : level === 2
          ? 'text-base font-semibold text-white mt-4 mb-2'
          : 'text-sm font-semibold text-purple-300 mt-4 mb-1.5';
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
      nodes.push(<hr key={`hr-${key++}`} className="my-4 border-gray-800" />);
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
    // Markdown link [text](url)
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
    if (tok.type === 'bold') return <strong key={k} className="text-white font-semibold">{tok.value}</strong>;
    if (tok.type === 'code') return (
      <code key={k} className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-300 text-xs font-mono">{tok.value}</code>
    );
    if (tok.type === 'link') return (
      <a key={k} href={tok.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{tok.value}</a>
    );
    return <span key={k}>{tok.value}</span>;
  });
}
