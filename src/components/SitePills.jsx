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
    <div className="flex flex-wrap gap-2">
      {sites.map((site) => {
        const isActive = site.id === currentSiteId;
        const score = latestScores?.[site.id];
        const dotColor = score >= 90 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score != null ? 'bg-red-500' : 'bg-gray-600';

        return (
          <button
            key={site.id}
            onClick={() => handleSelect(site.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
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
