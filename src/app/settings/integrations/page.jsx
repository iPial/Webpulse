import { cookies } from 'next/headers';
import { ensureTeam, getIntegrations } from '@/lib/db';
import IntegrationsManager from '@/components/IntegrationsManager';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Tabs from '@/components/ui/Tabs';

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  const team = await ensureTeam(cookieStore);
  const integrations = await getIntegrations(cookieStore, team.id);

  return (
    <PageShell>
      <Topbar
        eyebrow="Admin"
        title="Settings"
        subtitle="Configure notifications, API keys, and exports."
        actions={
          <Tabs
            currentPath="/settings/integrations"
            items={[
              { label: 'Sites', href: '/settings' },
              { label: 'Team', href: '/settings/team' },
              { label: 'Integrations', href: '/settings/integrations' },
            ]}
          />
        }
      />

      <IntegrationsManager teamId={team.id} initialIntegrations={integrations} />
    </PageShell>
  );
}
