'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';

export default function AuditList({ audits }) {
  if (!audits) return null;

  const { critical = [], improvement = [], optional = [] } = audits;
  const hasAudits = critical.length > 0 || improvement.length > 0 || optional.length > 0;

  if (!hasAudits) {
    return (
      <Card className="text-center">
        <div className="flex items-center justify-center gap-2 text-good">
          <span className="w-2 h-2 rounded-full bg-good" />
          <span className="text-[14px] font-medium">All audits passing</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <Card padding="sm" className="!p-[14px_18px]">
        <div className="flex items-center gap-5 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted">
            Audit summary
          </span>
          {critical.length > 0 && <Pill variant="bad" dot>{critical.length} critical</Pill>}
          {improvement.length > 0 && (
            <Pill variant="warn" dot>{improvement.length} to improve</Pill>
          )}
          {optional.length > 0 && <Pill dot>{optional.length} optional</Pill>}
        </div>
      </Card>

      {critical.length > 0 && (
        <AuditSection title="Fix immediately" tone="bad" audits={critical} defaultOpen />
      )}
      {improvement.length > 0 && (
        <AuditSection title="Future improvement" tone="warn" audits={improvement} />
      )}
      {optional.length > 0 && (
        <AuditSection title="Optional" tone="default" audits={optional} />
      )}
    </div>
  );
}

function AuditSection({ title, tone, audits, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toneMap = {
    bad: { headerClass: 'text-bad', dot: 'bg-bad', cardClass: '!border-bad/20 !bg-bad-bg/30' },
    warn: { headerClass: 'text-warn', dot: 'bg-warn', cardClass: '!border-warn/20 !bg-warn-bg/40' },
    default: { headerClass: 'text-cobalt', dot: 'bg-cobalt', cardClass: '!border-line !bg-sky/20' },
  };
  const c = toneMap[tone] || toneMap.default;

  return (
    <Card className={c.cardClass} padding="sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <h3 className={`text-[14px] font-semibold ${c.headerClass}`}>
            {title} ({audits.length})
          </h3>
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="pt-2 flex flex-col gap-1">
          {audits.map((audit) => (
            <AuditRow key={audit.id} audit={audit} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AuditRow({ audit }) {
  const [expanded, setExpanded] = useState(false);
  const scoreClass =
    audit.score < 50
      ? 'bg-bad-bg text-bad'
      : audit.score < 90
      ? 'bg-warn-bg text-warn'
      : 'bg-good-bg text-good';

  return (
    <div
      className="rounded-[12px] p-[12px] cursor-pointer transition-colors hover:bg-surface/80"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <span
          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-r-sm ${scoreClass} shrink-0 mt-0.5`}
        >
          {audit.score}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] text-ink leading-snug">{audit.title}</p>
            {audit.displayValue && (
              <span className="font-mono text-[10px] text-muted bg-paper-2 px-1.5 py-0.5 rounded-r-sm shrink-0">
                {audit.displayValue}
              </span>
            )}
          </div>

          {expanded && audit.description && (
            <div className="mt-2 text-[12px] text-ink-2 leading-relaxed border-t border-line pt-2">
              {renderDescription(audit.description)}
            </div>
          )}
        </div>

        <svg
          className={`w-3.5 h-3.5 text-muted shrink-0 mt-1 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

function renderDescription(desc) {
  if (!desc) return null;
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`}>
          {desc.slice(lastIndex, match.index).replace(/`([^`]+)`/g, '$1')}
        </span>
      );
    }
    parts.push(
      <a
        key={`a-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cobalt hover:underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < desc.length) {
    parts.push(
      <span key={`t-${lastIndex}`}>
        {desc.slice(lastIndex).replace(/`([^`]+)`/g, '$1')}
      </span>
    );
  }

  return parts.length > 0 ? parts : desc.replace(/`([^`]+)`/g, '$1').trim();
}
