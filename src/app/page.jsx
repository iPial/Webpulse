import { cookies } from 'next/headers';
import { ensureTeam, getLatestResults } from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import SiteCard from '@/components/SiteCard';
import OverviewStats from '@/components/OverviewStats';

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <EmptyState message="Sign in to view your dashboard." />;
  }

  const team = await ensureTeam(cookieStore);
  const results = await getLatestResults(cookieStore, team.id);

  // Group results by site
  const siteMap = new Map();
  for (const row of results) {
    if (!siteMap.has(row.site_id)) {
      siteMap.set(row.site_id, { site: row.sites, mobile: null, desktop: null });
    }
    siteMap.get(row.site_id)[row.strategy] = row;
  }

  const sites = Array.from(siteMap.values());

  if (sites.length === 0) {
    return <EmptyState message="No scan results yet. Add sites in Settings and run your first scan." showSetup />;
  }

  // Compute aggregate stats
  const stats = computeStats(sites);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">
          {sites.length} site{sites.length !== 1 ? 's' : ''} monitored
        </p>
      </div>

      <OverviewStats stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-8">
        {sites.map(({ site, mobile, desktop }) => (
          <SiteCard
            key={site.id}
            site={site}
            mobile={mobile}
            desktop={desktop}
          />
        ))}
      </div>
    </div>
  );
}

function computeStats(sites) {
  let totalPerf = 0;
  let totalA11y = 0;
  let totalBP = 0;
  let totalSEO = 0;
  let count = 0;
  let criticalTotal = 0;
  let improvementTotal = 0;

  for (const { mobile, desktop } of sites) {
    const result = mobile || desktop;
    if (!result) continue;

    totalPerf += result.performance;
    totalA11y += result.accessibility;
    totalBP += result.best_practices;
    totalSEO += result.seo;
    count++;

    const audits = result.audits || {};
    criticalTotal += audits.critical?.length || 0;
    improvementTotal += audits.improvement?.length || 0;
  }

  return {
    avgPerformance: count > 0 ? Math.round(totalPerf / count) : 0,
    avgAccessibility: count > 0 ? Math.round(totalA11y / count) : 0,
    avgBestPractices: count > 0 ? Math.round(totalBP / count) : 0,
    avgSEO: count > 0 ? Math.round(totalSEO / count) : 0,
    siteCount: count,
    criticalTotal,
    improvementTotal,
  };
}

function EmptyState({ message, showSetup }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      </div>
      <p className="text-gray-400 mb-4">{message}</p>
      {showSetup && (
        <a
          href="/settings"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Go to Settings
        </a>
      )}
    </div>
  );
}
