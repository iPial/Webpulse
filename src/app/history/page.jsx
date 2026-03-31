import { cookies } from 'next/headers';
import { ensureTeam, getSites, getSiteHistory, getLatestResults } from '@/lib/db';
import SitePills from '@/components/SitePills';
import TrendChart from '@/components/TrendChart';
import VitalsChart from '@/components/VitalsChart';
import HistoryTable from '@/components/HistoryTable';

export default async function HistoryPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();

  const team = await ensureTeam(cookieStore);
  const sites = await getSites(cookieStore, team.id);

  if (sites.length === 0) {
    return <EmptyState message="Add sites in Settings to start tracking history." />;
  }

  // Get latest results for score dots on pills
  const latestResults = await getLatestResults(cookieStore, team.id);
  const latestScores = {};
  for (const row of latestResults) {
    if (row.strategy === 'mobile' && !latestScores[row.site_id]) {
      latestScores[row.site_id] = row.performance;
    }
  }

  const siteId = resolvedParams.siteId
    ? parseInt(resolvedParams.siteId, 10)
    : sites[0].id;

  const currentSite = sites.find((s) => s.id === siteId) || sites[0];
  const history = await getSiteHistory(cookieStore, currentSite.id, { limit: 12 });

  // Compute summary: first vs latest
  const latest = history[0];
  const oldest = history[history.length - 1];
  const perfChange = latest && oldest ? latest.performance - oldest.performance : null;
  const dateRange = oldest && latest
    ? `${oldest.month} — ${latest.month}`
    : '';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-sm text-gray-400 mt-1">Month-over-month trends and analytics</p>
      </div>

      {/* Site Pills */}
      <div className="mb-6">
        <SitePills sites={sites} currentSiteId={currentSite.id} latestScores={latestScores} />
      </div>

      {/* Site Summary */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{currentSite.name}</h2>
            <p className="text-xs text-gray-500">{currentSite.url}</p>
          </div>
          <div className="flex items-center gap-6 text-right">
            {latest && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Current</p>
                <p className={`text-xl font-bold ${latest.performance >= 90 ? 'text-score-good' : latest.performance >= 50 ? 'text-score-average' : 'text-score-poor'}`}>
                  {latest.performance}
                </p>
              </div>
            )}
            {perfChange !== null && history.length > 1 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Change</p>
                <p className={`text-xl font-bold ${perfChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {perfChange >= 0 ? '+' : ''}{perfChange}
                </p>
              </div>
            )}
            {dateRange && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Period</p>
                <p className="text-sm text-gray-300">{dateRange}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <TrendChart data={history} />
        <VitalsChart data={history} />
        <HistoryTable data={history} />
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-gray-400 mb-4">{message}</p>
      <a href="/settings" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
        Go to Settings
      </a>
    </div>
  );
}
