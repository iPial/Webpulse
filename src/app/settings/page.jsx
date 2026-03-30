import { cookies } from 'next/headers';
import Link from 'next/link';
import { getUserTeams, getSites } from '@/lib/db';
import SitesManager from '@/components/SitesManager';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const teams = await getUserTeams(cookieStore);

  if (teams.length === 0) {
    return <NoTeamState />;
  }

  const teamId = teams[0].id;
  const sites = await getSites(cookieStore, teamId);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your monitored sites</p>
        </div>
        <Link
          href="/settings/integrations"
          className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Integrations
        </Link>
      </div>

      <SitesManager teamId={teamId} initialSites={sites} />
    </div>
  );
}

function NoTeamState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-gray-400 mb-4">You need a team to manage sites.</p>
      <p className="text-sm text-gray-500">A team will be created automatically on first use.</p>
    </div>
  );
}
