import { cookies } from 'next/headers';
import Link from 'next/link';
import { ensureTeam, getIntegrations } from '@/lib/db';
import IntegrationsManager from '@/components/IntegrationsManager';

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  const team = await ensureTeam(cookieStore);
  const integrations = await getIntegrations(cookieStore, team.id);

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/settings"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-gray-400 mt-1">Configure notifications and exports</p>
        </div>
      </div>

      <IntegrationsManager teamId={team.id} initialIntegrations={integrations} />
    </div>
  );
}
