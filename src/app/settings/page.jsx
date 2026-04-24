import { cookies } from 'next/headers';
import { ensureTeam, getSites } from '@/lib/db';
import SitesManager from '@/components/SitesManager';
import ScheduleBanner from '@/components/ScheduleBanner';
import ScheduleManager from '@/components/ScheduleManager';
import PasswordUpdate from '@/components/PasswordUpdate';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Tabs from '@/components/ui/Tabs';
import Card from '@/components/ui/Card';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const team = await ensureTeam(cookieStore);
  const sites = await getSites(cookieStore, team.id);

  return (
    <PageShell>
      <Topbar
        eyebrow="Admin"
        title="Settings"
        subtitle="Manage your monitored sites, team, and integrations."
        actions={
          <Tabs
            currentPath="/settings"
            items={[
              { label: 'Sites', href: '/settings' },
              { label: 'Team', href: '/settings/team' },
              { label: 'Integrations', href: '/settings/integrations' },
            ]}
          />
        }
      />

      <ScheduleBanner teamId={team.id} />

      <div className="flex flex-col gap-6">
        <ScheduleManager teamId={team.id} />
        <SitesManager teamId={team.id} initialSites={sites} />

        <div className="grid md:grid-cols-2 grid-cols-1 gap-6 mt-4">
          <Card>
            <h3 className="font-semibold text-[15px] text-ink">Account</h3>
            <p className="text-[12px] text-muted mt-0.5">Password and session settings.</p>
            <div className="mt-4">
              <PasswordUpdate />
            </div>
          </Card>

          <Card className="!border-bad/30">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-bad">
              Danger zone
            </div>
            <h3 className="font-semibold text-[15px] text-ink mt-1">Leaving Webpulse?</h3>
            <p className="text-[13px] text-muted mt-2">
              Deleting your workspace permanently removes all sites, scan history,
              AI recommendations and fix tasks. Export data first if you want to keep it.
            </p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
