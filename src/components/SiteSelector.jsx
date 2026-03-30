'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SiteSelector({ sites, currentSiteId }) {
  return (
    <Suspense fallback={<SelectFallback />}>
      <SiteSelectorInner sites={sites} currentSiteId={currentSiteId} />
    </Suspense>
  );
}

function SiteSelectorInner({ sites, currentSiteId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('siteId', e.target.value);
    router.push(`/history?${params.toString()}`);
  }

  return (
    <select
      value={currentSiteId || ''}
      onChange={handleChange}
      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {sites.map((site) => (
        <option key={site.id} value={site.id}>
          {site.name}
        </option>
      ))}
    </select>
  );
}

function SelectFallback() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-400 w-48">
      Loading...
    </div>
  );
}
