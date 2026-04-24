'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SitePills({ sites, currentSiteId, latestScores }) {
  return (
    <Suspense fallback={<div className="h-9" />}>
      <SitePillsInner sites={sites} currentSiteId={currentSiteId} latestScores={latestScores} />
    </Suspense>
  );
}

function SitePillsInner({ sites, currentSiteId, latestScores }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(siteId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('siteId', siteId);
    router.push(`/history?${params.toString()}`);
  }

  return (
    <div className="inline-flex gap-[2px] p-[3px] bg-surface border border-line rounded-r-pill shadow-1">
      {sites.map((site) => {
        const isActive = site.id === currentSiteId;
        const score = latestScores?.[site.id];
        const dotColor =
          score >= 90 ? 'bg-good' : score >= 50 ? 'bg-warn' : score != null ? 'bg-bad' : 'bg-line-2';

        return (
          <button
            key={site.id}
            onClick={() => handleSelect(site.id)}
            className={`inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-r-pill text-[13px] font-semibold transition-colors ${
              isActive
                ? 'bg-ink text-surface shadow-ink'
                : 'text-ink-2 hover:bg-paper-2'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            {site.name}
          </button>
        );
      })}
    </div>
  );
}
