import { cookies } from 'next/headers';
import { ensureTeam, getLatestResults, getRecentActivity, getSiteHistoryForOverview } from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import SiteReportCard from '@/components/SiteReportCard';
import OverviewActions from '@/components/OverviewActions';
import ActivityFeed from '@/components/ActivityFeed';

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <EmptyState message="Sign in to view your dashboard." />;
  }

  const team = await ensureTeam(cookieStore);
  const [results, activity, historyBySite] = await Promise.all([
    getLatestResults(cookieStore, team.id),
    getRecentActivity(cookieStore, team.id),
    getSiteHistoryForOverview(cookieStore, team.id, { days: 14 }),
  ]);

  // Group results by site with current + previous for regression
  const siteMap = new Map();
  for (const row of results) {
    if (!siteMap.has(row.site_id)) {
      siteMap.set(row.site_id, {
        site: row.sites,
        mobile: null,
        desktop: null,
        prevMobile: null,
        prevDesktop: null,
      });
    }
    const entry = siteMap.get(row.site_id);
    if (!entry[row.strategy]) {
      entry[row.strategy] = row;
    } else if (row.strategy === 'mobile' && !entry.prevMobile) {
      entry.prevMobile = row;
    } else if (row.strategy === 'desktop' && !entry.prevDesktop) {
      entry.prevDesktop = row;
    }
  }

  const sites = Array.from(siteMap.values());

  if (sites.length === 0) {
    return <EmptyState message="No scan results yet. Add sites in Settings and run your first scan." showSetup />;
  }

  // Summary counts (without averaging across different sites)
  let totalCritical = 0;
  for (const s of sites) {
    const r = s.mobile || s.desktop;
    if (r?.audits?.critical) totalCritical += r.audits.critical.length;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-gray-400 mt-1">
            <strong className="text-gray-200">{sites.length}</strong> site{sites.length !== 1 ? 's' : ''} monitored
            {totalCritical > 0 ? (
              <>
                {' · '}
                <span className="text-red-400">{totalCritical} critical issue{totalCritical !== 1 ? 's' : ''} across all sites</span>
              </>
            ) : (
              <>
                {' · '}
                <span className="text-green-400">No critical issues</span>
              </>
            )}
          </p>
        </div>
        <OverviewActions teamId={team.id} />
      </div>

      {/* Per-site report cards */}
      <div className="space-y-4">
        {sites.map(({ site, mobile, desktop, prevMobile }) => (
          <SiteReportCard
            key={site.id}
            site={site}
            mobile={mobile}
            desktop={desktop}
            prevMobile={prevMobile}
            history={historyBySite[site.id] || []}
          />
        ))}
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <ActivityFeed activity={activity} />
      </div>
    </div>
  );
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
        <a href="/settings" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          Go to Settings
        </a>
      )}
    </div>
  );
}
