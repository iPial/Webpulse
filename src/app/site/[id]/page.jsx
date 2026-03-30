import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSiteById, getSiteResults } from '@/lib/db';
import StrategyTabs from '@/components/StrategyTabs';
import AIRecommendations from '@/components/AIRecommendations';

export default async function SiteDetailPage({ params }) {
  const { id } = await params;
  const siteId = parseInt(id, 10);

  if (isNaN(siteId)) {
    return <ErrorState message="Invalid site ID." />;
  }

  const cookieStore = await cookies();
  const site = await getSiteById(cookieStore, siteId);

  if (!site) {
    return <ErrorState message="Site not found." />;
  }

  const results = await getSiteResults(cookieStore, siteId, { limit: 4 });

  // Find latest mobile and desktop results
  const mobile = results.find((r) => r.strategy === 'mobile') || null;
  const desktop = results.find((r) => r.strategy === 'desktop') || null;

  if (!mobile && !desktop) {
    return (
      <div>
        <SiteHeader site={site} />
        <div className="mt-8 text-center text-gray-400">
          <p>No scan results yet for this site.</p>
          <p className="text-sm mt-1">Results will appear after the next scheduled scan.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SiteHeader site={site} />
      <div className="mt-6 space-y-6">
        <StrategyTabs mobile={mobile} desktop={desktop} />
        <AIRecommendations siteId={site.id} />
      </div>
    </div>
  );
}

function SiteHeader({ site }) {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">{site.name}</h1>
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
        >
          {site.url}
        </a>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-gray-400 mb-4">{message}</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        Back to Overview
      </Link>
    </div>
  );
}
