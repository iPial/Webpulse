import TeamManager from '@/components/TeamManager';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Tabs from '@/components/ui/Tabs';

export default function TeamPage() {
  return (
    <PageShell>
      <Topbar
        eyebrow="Admin"
        title="Settings"
        subtitle="Manage who has access to your Webpulse workspace."
        actions={
          <Tabs
            currentPath="/settings/team"
            items={[
              { label: 'Sites', href: '/settings' },
              { label: 'Team', href: '/settings/team' },
              { label: 'Integrations', href: '/settings/integrations' },
            ]}
          />
        }
      />

      <TeamManager />
    </PageShell>
  );
}
