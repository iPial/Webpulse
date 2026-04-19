'use client';

import { useState } from 'react';

export default function AIRecommendations({ siteId, isWPRocket = false }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAnalyze() {
    setLoading(true);
    setError('');
    setRecommendations(null);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await res.json();
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">AI Recommendations</h3>
          {isWPRocket && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              🚀 WP Rocket tuned
            </span>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : recommendations ? 'Re-analyze' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
          Generating recommendations...
        </div>
      )}

      {recommendations && !loading && (
        <div className="text-sm text-gray-300 leading-relaxed">
          <MarkdownBlock text={recommendations} />
        </div>
      )}

      {!recommendations && !loading && !error && (
        <p className="text-sm text-gray-500">
          Click Analyze to get {isWPRocket ? 'WP Rocket-specific' : 'AI-powered'} recommendations based on your latest scan results.
          {!isWPRocket && ' Tag this site as WP Rocket in Settings for even more precise fix instructions.'}
          {' '}Add your AI API key in Settings &gt; Integrations.
        </p>
      )}
    </div>
  );
}

// Minimal markdown renderer for headings (#, ##, ###), bold (**…**),
// inline code (`…`), unordered lists (- / *), and paragraphs.
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

    // Headings
    const h = /^(#{1,3})\s+(.+)/.exec(line);
    if (h) {
      flushList();
      flushPara();
      const level = h[1].length;
      const content = h[2];
      const cls =
        level === 1
          ? 'text-lg font-bold text-white mt-5 mb-2'
          : level === 2
          ? 'text-base font-semibold text-white mt-4 mb-2'
          : 'text-sm font-semibold text-purple-300 mt-4 mb-1.5';
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      nodes.push(
        <Tag key={`h-${key++}`} className={cls}>
          {renderInline(content, `h-${key}`)}
        </Tag>
      );
      continue;
    }

    // List items
    const li = /^\s*[-*]\s+(.+)/.exec(line);
    if (li) {
      flushPara();
      listBuffer.push(li[1]);
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line)) {
      flushList();
      flushPara();
      nodes.push(<hr key={`hr-${key++}`} className="my-4 border-gray-800" />);
      continue;
    }

    // Regular paragraph line
    flushList();
    paraBuffer.push(line);
  }

  flushList();
  flushPara();

  return <div>{nodes}</div>;
}

// Inline rendering: bold **x**, inline code `x`, and keep other text as-is.
function renderInline(text, keyBase) {
  // Tokenize on ** or `
  const tokens = [];
  let buffer = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      if (buffer) { tokens.push({ type: 'text', value: buffer }); buffer = ''; }
      const end = text.indexOf('**', i + 2);
      if (end === -1) {
        buffer += text.slice(i);
        i = text.length;
      } else {
        tokens.push({ type: 'bold', value: text.slice(i + 2, end) });
        i = end + 2;
      }
    } else if (text[i] === '`') {
      if (buffer) { tokens.push({ type: 'text', value: buffer }); buffer = ''; }
      const end = text.indexOf('`', i + 1);
      if (end === -1) {
        buffer += text.slice(i);
        i = text.length;
      } else {
        tokens.push({ type: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
      }
    } else {
      buffer += text[i];
      i++;
    }
  }
  if (buffer) tokens.push({ type: 'text', value: buffer });

  return tokens.map((tok, idx) => {
    const k = `${keyBase}-${idx}`;
    if (tok.type === 'bold') {
      return <strong key={k} className="text-white font-semibold">{tok.value}</strong>;
    }
    if (tok.type === 'code') {
      return (
        <code key={k} className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-300 text-xs font-mono">
          {tok.value}
        </code>
      );
    }
    return <span key={k}>{tok.value}</span>;
  });
}
