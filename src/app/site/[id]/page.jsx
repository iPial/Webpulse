import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getSiteById,
  getSiteResults,
  getPublicSiteById,
  getPublicSiteResults,
} from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import SiteScansView from '@/components/SiteScansView';
import AIRecommendations from '@/components/AIRecommendations';
import ScanHistoryTable from '@/components/ScanHistoryTable';
import SiteDetailActions from '@/components/SiteDetailActions';
import PageShell from '@/components/ui/PageShell';
import Card from '@/components/ui/Card';
import Logo from '@/components/ui/Logo';
import LocalTime from '@/components/ui/LocalTime';

export default async function SiteDetailPage({ params }) {
  const { id } = await params;
  const siteId = parseInt(id, 10);

  if (isNaN(siteId)) {
    return (
      <PageShell>
        <ErrorState message="Invalid site ID." />
      </PageShell>
    );
  }

  const cookieStore = await cookies();

  // 1) Try authenticated path first. If the user is signed in AND has access
  //    to this site (via RLS), render the full editor view.
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  let site = null;
  let results = null;
  let publicView = false;

  if (user) {
    site = await getSiteById(cookieStore, siteId);
    if (site) {
      results = await getSiteResults(cookieStore, siteId, { limit: 20 });
    }
  }

  // 2) If no authed access, fall back to public path. The site is only
  //    surfaced if its owner has flipped is_public=true.
  if (!site) {
    site = await getPublicSiteById(siteId);
    if (site) {
      publicView = true;
      results = await getPublicSiteResults(siteId, { limit: 20 });
    }
  }

  // 3) Still nothing → either site doesn't exist, or it's private and the
  //    visitor isn't signed in. Bounce to login (preserving the requested
  //    URL) so a logged-out owner can come back to their own private report.
  if (!site) {
    if (!user) {
      redirect(`/login?redirect=${encodeURIComponent(`/site/${siteId}`)}`);
    }
    return (
      <PageShell>
        <ErrorState message="Site not found." />
      </PageShell>
    );
  }

  results = results || [];
  const mobile = results.find((r) => r.strategy === 'mobile') || null;
  const desktop = results.find((r) => r.strategy === 'desktop') || null;

  if (!mobile && !desktop) {
    return (
      <PageShell publicView={publicView}>
        <SiteHeader site={site} publicView={publicView} />
        <Card variant="hairline" className="text-center py-12 mt-6">
          <div className="mx-auto w-[56px] h-[56px] rounded-full bg-paper-2 grid place-items-center mb-3">
            <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <p className="text-[14px] text-muted mb-1">No scan results yet for this site.</p>
          {!publicView && (
            <p className="text-[12px] text-muted">
              Run a scan from Settings or wait for the next scheduled scan.
            </p>
          )}
        </Card>
      </PageShell>
    );
  }

  const primaryResult = mobile || desktop;
  const scanCount = results.length;
  const lastScanned = primaryResult.scanned_at;

  return (
    <PageShell publicView={publicView}>
      <SiteHeader site={site} publicView={publicView} />

      {/* Summary + actions */}
      <Card padding="sm" className="!p-[14px_18px] mt-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 text-[12px] flex-wrap">
            <div>
              <span className="text-muted">Last scan: </span>
              <LocalTime iso={lastScanned} format="default" className="text-ink-2 font-mono" />
            </div>
            <div>
              <span className="text-muted">Total scans: </span>
              <span className="text-ink-2 font-mono">{scanCount}</span>
            </div>
            <div>
              <span className="text-muted">Frequency: </span>
              <span className="text-ink-2">{site.scan_frequency}</span>
            </div>
          </div>
          {!publicView && <SiteDetailActions siteId={site.id} />}
        </div>
      </Card>

      <div className="mt-6 flex flex-col gap-6">
        <SiteScansView results={results} mobile={mobile} desktop={desktop} />
        <AIRecommendations
          siteId={site.id}
          isWPRocket={site.tags?.includes('wp-rocket')}
          initialMarkdown={site.ai_markdown || null}
          initialGeneratedAt={site.ai_generated_at || null}
          readOnly={publicView}
        />
        <ScanHistoryTable results={results} />
      </div>
    </PageShell>
  );
}

function SiteHeader({ site, publicView }) {
  return (
    <div className="flex items-center gap-4">
      {!publicView && (
        <Link
          href="/"
          className="flex items-center justify-center w-[32px] h-[32px] rounded-r-sm bg-surface border border-line text-ink-2 hover:bg-paper-2 transition-colors shrink-0 shadow-1"
          aria-label="Back to Overview"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
      )}
      <Logo site={site} size="xl" />
      <div className="min-w-0">
        <h1 className="font-serif text-[24px] md:text-[40px] leading-[1.05] tracking-tight text-ink truncate">
          {site.name}
        </h1>
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-muted hover:text-cobalt transition-colors"
        >
          {site.url} ↗
        </a>
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <Card variant="hairline" className="text-center py-12 mt-6">
      <p className="text-[14px] text-muted mb-4">{message}</p>
      <Link
        href="/"
        className="inline-flex items-center px-4 py-2 rounded-r-pill bg-ink text-surface text-[13px] font-medium shadow-ink hover:brightness-110"
      >
        Back to Overview
      </Link>
    </Card>
  );
}
