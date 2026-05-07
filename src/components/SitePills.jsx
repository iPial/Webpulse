'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import Logo from '@/components/ui/Logo';

// SitePills (now a proper dropdown despite the legacy filename) — site
// selector used by History. Earlier versions tried to be clever:
//   v1) text pills in a row → overflowed past the viewport with 10+ sites
//   v2) logo tiles that expand on hover → felt confusing and didn't work
//       on touch
//
// This version is a single button showing the active site + a dropdown
// menu listing every site with logo, name, and latest mobile perf
// score. Scales to any team size, accessible, keyboard- and touch-
// friendly. Closes on outside click and Escape.
export default function SitePills({ sites, currentSiteId, latestScores }) {
  return (
    <Suspense fallback={<div className="h-9" />}>
      <SiteSelectInner sites={sites} currentSiteId={currentSiteId} latestScores={latestScores} />
    </Suspense>
  );
}

function scoreClass(score) {
  if (score == null) return 'text-muted';
  if (score >= 90) return 'text-good';
  if (score >= 50) return 'text-warn';
  return 'text-bad';
}

function dotClass(score) {
  if (score == null) return 'bg-line-2';
  if (score >= 90) return 'bg-good';
  if (score >= 50) return 'bg-warn';
  return 'bg-bad';
}

function SiteSelectInner({ sites, currentSiteId, latestScores }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const currentSite = sites.find((s) => s.id === currentSiteId) || sites[0];
  const currentScore = latestScores?.[currentSite?.id];

  // Close on outside click + Escape. Mounted only while open so we don't
  // pay the listener cost when the menu is idle.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleSelect(siteId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('siteId', siteId);
    router.push(`/history?${params.toString()}`);
    setOpen(false);
  }

  if (!currentSite) return null;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-3 pl-2 pr-3 py-2 rounded-r-pill bg-surface border border-line shadow-1 hover:border-ink-2/30 transition-colors min-w-[220px]"
      >
        <Logo site={currentSite} size="sm" />
        <span className="flex flex-col items-start text-left flex-1 min-w-0">
          <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted leading-none">
            Viewing
          </span>
          <span className="text-[13px] font-semibold text-ink truncate max-w-[180px] leading-tight mt-[2px]">
            {currentSite.name}
          </span>
        </span>
        {currentScore != null && (
          <span className={`text-[13px] font-semibold tabular-nums ${scoreClass(currentScore)}`}>
            {currentScore}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-[320px] max-h-[420px] overflow-y-auto bg-surface border border-line rounded-r-md shadow-2 z-30 py-1.5"
        >
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-muted border-b border-line">
            Switch site · {sites.length}
          </div>
          {sites.map((site) => {
            const isActive = site.id === currentSite.id;
            const score = latestScores?.[site.id];
            return (
              <button
                key={site.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(site.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-paper-2' : 'hover:bg-paper-2/60'
                }`}
              >
                <Logo site={site} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-ink truncate">
                    {site.name}
                  </span>
                  {site.url && (
                    <span className="block text-[11px] text-muted truncate">
                      {prettyUrl(site.url)}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${dotClass(score)}`} />
                  <span className={`text-[13px] font-semibold tabular-nums ${scoreClass(score)}`}>
                    {score ?? '—'}
                  </span>
                </span>
                {isActive && (
                  <svg className="w-4 h-4 text-ink shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function prettyUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
