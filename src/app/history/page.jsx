import { cookies } from 'next/headers';
import { getUserTeams, getSites, getSiteHistory } from '@/lib/db';
import SiteSelector from '@/components/SiteSelector';
import TrendChart from '@/components/TrendChart';
import HistoryTable from '@/components/HistoryTable';

export default async function HistoryPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();

  const teams = await getUserTeams(cookieStore);
  if (teams.length === 0) {
    return <EmptyState message="Create a team to view history." />;
  }

  const teamId = teams[0].id;
  const sites = await getSites(cookieStore, teamId);

  if (sites.length === 0) {
    return <EmptyState message="Add sites in Settings to start tracking history." />;
  }

  // Use selected site or default to first
  const siteId = resolvedParams.siteId
    ? parseInt(resolvedParams.siteId, 10)
    : sites[0].id;

  const currentSite = sites.find((s) => s.id === siteId) || sites[0];
  const history = await getSiteHistory(cookieStore, currentSite.id, { limit: 12 });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-sm text-gray-400 mt-1">Month-over-month trends</p>
        </div>
        <SiteSelector sites={sites} currentSiteId={currentSite.id} />
      </div>

      <div className="space-y-6">
        <TrendChart data={history} />
        <HistoryTable data={history} />
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-gray-400 mb-4">{message}</p>
      <a
        href="/settings"
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Go to Settings
      </a>
    </div>
  );
}
