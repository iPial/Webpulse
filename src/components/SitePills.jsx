'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Logo from '@/components/ui/Logo';

// SitePills — compact site switcher used by History (and any future page
// that needs a horizontal site picker). Each pill collapses to a 32px logo
// tile and expands on hover or when it's the active selection, revealing
// the site name. This keeps the row scannable when there are 10+ sites
// without overflowing the viewport.
//
// A small status dot in the corner of the tile reflects the latest mobile
// performance score (green/amber/red) so users still get an at-a-glance
// health signal even in the collapsed state.
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
    <div className="inline-flex gap-[4px] p-[4px] bg-surface border border-line rounded-r-pill shadow-1 max-w-full flex-wrap">
      {sites.map((site) => {
        const isActive = site.id === currentSiteId;
        const score = latestScores?.[site.id];
        const dotColor =
          score >= 90 ? 'bg-good' : score >= 50 ? 'bg-warn' : score != null ? 'bg-bad' : 'bg-line-2';

        return (
          <button
            key={site.id}
            onClick={() => handleSelect(site.id)}
            title={site.name}
            aria-label={site.name}
            className={`group/pill relative inline-flex items-center gap-[8px] pl-[3px] pr-[3px] py-[3px] rounded-r-pill transition-[max-width,background-color,color,padding] duration-200 ease-out overflow-hidden ${
              isActive
                ? 'bg-ink text-surface shadow-ink max-w-[260px] pr-[14px]'
                : 'text-ink-2 hover:bg-paper-2 max-w-[40px] hover:max-w-[260px] hover:pr-[14px]'
            }`}
          >
            <span className="relative shrink-0">
              <Logo site={site} size="sm" />
              <span
                className={`absolute -bottom-[2px] -right-[2px] w-[10px] h-[10px] rounded-full border-2 border-surface ${dotColor}`}
              />
            </span>
            <span
              className={`text-[13px] font-semibold whitespace-nowrap transition-opacity duration-150 ${
                isActive
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/pill:opacity-100'
              }`}
            >
              {site.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
