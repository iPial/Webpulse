'use client';

import { useState } from 'react';

export default function AuditList({ audits }) {
  if (!audits) return null;

  const { critical = [], improvement = [], optional = [] } = audits;
  const hasAudits = critical.length > 0 || improvement.length > 0 || optional.length > 0;

  if (!hasAudits) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">All audits passing</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-6">
        <span className="text-xs text-gray-400">Audit Summary:</span>
        {critical.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {critical.length} critical
          </span>
        )}
        {improvement.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {improvement.length} to improve
          </span>
        )}
        {optional.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {optional.length} optional
          </span>
        )}
      </div>

      {critical.length > 0 && (
        <AuditSection title="Fix Immediately" color="red" audits={critical} defaultOpen />
      )}
      {improvement.length > 0 && (
        <AuditSection title="Future Improvement" color="yellow" audits={improvement} />
      )}
      {optional.length > 0 && (
        <AuditSection title="Optional" color="blue" audits={optional} />
      )}
    </div>
  );
}

function AuditSection({ title, color, audits, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colors = {
    red: { bg: 'bg-red-500/5', border: 'border-red-500/20', dot: 'bg-red-500', text: 'text-red-400', hoverBg: 'hover:bg-red-500/10' },
    yellow: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', dot: 'bg-yellow-500', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/10' },
    blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-500', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/10' },
  };

  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <h3 className={`text-sm font-semibold ${c.text}`}>
            {title} ({audits.length})
          </h3>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-1">
          {audits.map((audit) => (
            <AuditRow key={audit.id} audit={audit} colorClass={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({ audit, colorClass }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = audit.score < 50 ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10';

  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-colors ${colorClass.hoverBg}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        {/* Score badge */}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreColor} shrink-0 mt-0.5`}>
          {audit.score}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title + impact */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-gray-200">{audit.title}</p>
            {audit.displayValue && (
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
                {audit.displayValue}
              </span>
            )}
          </div>

          {/* Expanded description */}
          {expanded && audit.description && (
            <div className="mt-2 text-xs text-gray-400 leading-relaxed border-t border-gray-800/50 pt-2">
              {cleanDescription(audit.description)}
            </div>
          )}
        </div>

        {/* Expand indicator */}
        <svg
          className={`w-3.5 h-3.5 text-gray-600 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

// Clean Lighthouse audit descriptions (remove markdown links, trim)
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/`([^`]+)`/g, '$1') // remove backticks
    .trim();
}
