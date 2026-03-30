import { cookies } from 'next/headers';
import Link from 'next/link';
import { ensureTeam, getSites } from '@/lib/db';
import SitesManager from '@/components/SitesManager';
import ScheduleBanner from '@/components/ScheduleBanner';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const team = await ensureTeam(cookieStore);
  const sites = await getSites(cookieStore, team.id);

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

      <ScheduleBanner />
      <SitesManager teamId={team.id} initialSites={sites} />
    </div>
  );
}
