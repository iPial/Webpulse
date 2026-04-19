import { cookies } from 'next/headers';
import Link from 'next/link';
import { getSiteById, getSiteResults } from '@/lib/db';
import StrategyTabs from '@/components/StrategyTabs';
import AIRecommendations from '@/components/AIRecommendations';
import ScanHistoryTable from '@/components/ScanHistoryTable';
import SiteDetailActions from '@/components/SiteDetailActions';
import SiteProgress from '@/components/SiteProgress';
import FixChecklist from '@/components/FixChecklist';
import { resolveLogoUrl } from '@/lib/logos';

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

  const results = await getSiteResults(cookieStore, siteId, { limit: 20 });

  // Find latest mobile and desktop results
  const mobile = results.find((r) => r.strategy === 'mobile') || null;
  const desktop = results.find((r) => r.strategy === 'desktop') || null;

  if (!mobile && !desktop) {
    return (
      <div>
        <SiteHeader site={site} logoUrl={resolveLogoUrl(site)} />
        <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-1">No scan results yet for this site.</p>
          <p className="text-xs text-gray-500">Run a scan from Settings or wait for the next scheduled scan.</p>
        </div>
      </div>
    );
  }

  const primaryResult = mobile || desktop;
  const scanCount = results.length;
  const lastScanned = primaryResult.scanned_at;

  return (
    <div>
      <SiteHeader site={site} logoUrl={resolveLogoUrl(site)} />

      {/* Summary bar */}
      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-500">Last scan: </span>
            <span className="text-gray-300">{new Date(lastScanned).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Total scans: </span>
            <span className="text-gray-300">{scanCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Frequency: </span>
            <span className="text-gray-300">{site.scan_frequency}</span>
          </div>
        </div>
        <SiteDetailActions siteId={site.id} />
      </div>

      {/* Main content */}
      <div className="mt-6 space-y-6">
        <SiteProgress results={results} />
        <StrategyTabs mobile={mobile} desktop={desktop} />
        <AIRecommendations siteId={site.id} isWPRocket={site.tags?.includes('wp-rocket')} />
        <FixChecklist siteId={site.id} />
        <ScanHistoryTable results={results} />
      </div>
    </div>
  );
}

function SiteHeader({ site, logoUrl }) {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </Link>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="w-10 h-10 rounded-lg border border-gray-800 bg-gray-900 object-contain p-1 shrink-0"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-white truncate">{site.name}</h1>
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
        >
          {site.url} ↗
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
