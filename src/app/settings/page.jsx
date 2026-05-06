import { cookies } from 'next/headers';
import { ensureTeam, getSites } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
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

  // Fetch schedules so SitesManager can render each row's "Next scan"
  // from the actual schedule's scheduledAt (instead of assuming 6am UTC).
  // Skipped on first run when there are no sites — there's nothing to
  // schedule against yet.
  let schedules = [];
  if (sites.length > 0) {
    const service = createServiceSupabase();
    const { data: schedulesData } = await service
      .from('integrations')
      .select('id, config')
      .eq('team_id', team.id)
      .eq('type', 'schedule');
    schedules = schedulesData || [];
  }

  // First-run / empty state. Brand-new accounts otherwise see Schedule
  // Manager, Account, and Danger Zone all stacked at once — overwhelming
  // when there's literally nothing to manage. Strip the page down to the
  // single thing that matters: add your first site.
  const isFirstRun = sites.length === 0;

  return (
    <PageShell>
      <Topbar
        eyebrow="Admin"
        title="Settings"
        subtitle={
          isFirstRun
            ? "Let's get your first site set up so we can start monitoring."
            : 'Manage your monitored sites, team, and integrations.'
        }
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

      {isFirstRun ? (
        <div className="flex flex-col gap-6">
          <Card variant="lime">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#364503' }}>
              Welcome to Webpulse
            </div>
            <h2 className="font-serif text-[28px] md:text-[32px] leading-tight mt-2 text-lime-ink">
              Add your first site to get started
            </h2>
            <p className="text-[13px] mt-2 max-w-prose" style={{ color: '#364503' }}>
              Drop in a URL and we&apos;ll start tracking PageSpeed scores, Core
              Web Vitals, and AI-suggested fixes. Schedules, notifications,
              and team settings unlock once you have at least one site.
            </p>
          </Card>

          <SitesManager teamId={team.id} initialSites={sites} initialSchedules={schedules} />
        </div>
      ) : (
        <>
          <ScheduleBanner teamId={team.id} />

          <div className="flex flex-col gap-6">
            <ScheduleManager teamId={team.id} sites={sites} />
            <SitesManager teamId={team.id} initialSites={sites} initialSchedules={schedules} />

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
        </>
      )}
    </PageShell>
  );
}
