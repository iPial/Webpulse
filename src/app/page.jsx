import { cookies } from 'next/headers';
import { ensureTeam, getLatestResults, getRecentActivity, getSiteHistoryForOverview, getSites } from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import SiteReportCard from '@/components/SiteReportCard';
import OverviewActions from '@/components/OverviewActions';
import ActivityFeed from '@/components/ActivityFeed';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';
import EmptyHero from '@/components/ui/EmptyHero';

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageShell>
        <Topbar eyebrow={todayEyebrow()} title="Overview" />
        <EmptyHero
          icon={<LockIcon />}
          title="Sign in to view your dashboard"
          message="Webpulse tracks PageSpeed scores, Core Web Vitals, and AI-suggested fixes for every site in your team."
          primaryCta={{ label: 'Sign in', href: '/login' }}
        />
      </PageShell>
    );
  }

  const team = await ensureTeam(cookieStore);
  const [results, activity, historyBySite, allSites] = await Promise.all([
    getLatestResults(cookieStore, team.id),
    getRecentActivity(cookieStore, team.id),
    getSiteHistoryForOverview(cookieStore, team.id, { days: 14 }),
    getSites(cookieStore, team.id),
  ]);

  // Group results by site with current + previous
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
    // Two flavors of empty state:
    //   • Truly fresh account → no sites at all → onboarding hero with steps
    //   • Sites added but never scanned → "run your first scan" prompt
    const isBrandNew = (allSites || []).length === 0;
    return (
      <PageShell>
        <Topbar eyebrow={todayEyebrow()} title="Overview" />
        {isBrandNew ? (
          <EmptyHero
            icon={<BoltIcon />}
            eyebrow="Welcome to Webpulse"
            title="Let's get your first scan running"
            message="Add a website and we'll start tracking PageSpeed scores, Core Web Vitals, and AI-suggested fixes — every week, automatically."
            primaryCta={{ label: 'Add your first site', href: '/settings' }}
            secondaryCta={{ label: 'Set up integrations', href: '/settings/integrations' }}
            steps={[
              { n: 1, title: 'Add a site', body: 'Drop in a URL and an optional logo. Takes about 10 seconds.' },
              { n: 2, title: 'Pick a schedule', body: 'Daily or weekly. We handle dispatch and retries for you.' },
              { n: 3, title: 'Get reports', body: 'Slack, email, or in-app — with AI-suggested fixes per issue.' },
            ]}
          />
        ) : (
          <EmptyHero
            icon={<BoltIcon />}
            title="No scan results yet"
            message="Your sites are added but haven't been scanned. Run your first scan from Settings or wait for the next scheduled run."
            primaryCta={{ label: 'Go to Settings', href: '/settings' }}
          />
        )}
      </PageShell>
    );
  }

  // Total critical issues across all sites (mobile preferred)
  let totalCritical = 0;
  for (const s of sites) {
    const r = s.mobile || s.desktop;
    if (r?.audits?.critical) totalCritical += r.audits.critical.length;
  }

  const subtitle =
    totalCritical > 0
      ? `${sites.length} site${sites.length !== 1 ? 's' : ''} monitored · ${totalCritical} critical issue${totalCritical !== 1 ? 's' : ''}`
      : `${sites.length} site${sites.length !== 1 ? 's' : ''} monitored · No critical issues`;

  return (
    <PageShell>
      <Topbar
        eyebrow={todayEyebrow()}
        title="Overview"
        subtitle={subtitle}
        actions={<OverviewActions teamId={team.id} />}
      />

      {/* Hero glance */}
      <div className="grid grid-cols-1 gap-[14px] mb-[14px]">
        <Card variant="ink">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-lime">
                At a glance
              </div>
              <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                <span className="font-serif text-[56px] md:text-[88px] leading-none tracking-tight text-lime">
                  {totalCritical}
                </span>
                <span className="font-serif text-[18px] md:text-[24px] text-surface/80">
                  critical issue{totalCritical !== 1 ? 's' : ''} across all sites
                </span>
              </div>
              <p className="text-[13px] md:text-[14px] mt-3 max-w-[520px]" style={{ color: '#A4A0AB' }}>
                {totalCritical > 0
                  ? "You've got work to do this week. Jump into the flagged sites below."
                  : "Everything's green today — keep it that way by shipping fixes as they're flagged."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-end">
              <Pill variant="lime" dot>
                {sites.length} site{sites.length !== 1 ? 's' : ''}
              </Pill>
              {totalCritical > 0 ? (
                <Pill variant="bad">🔴 {totalCritical} critical</Pill>
              ) : (
                <Pill variant="good">✅ All clear</Pill>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Per-site cards */}
      <div className="flex flex-col gap-4">
        {sites.map(({ site, mobile, desktop, prevMobile, prevDesktop }) => (
          <SiteReportCard
            key={site.id}
            site={site}
            mobile={mobile}
            desktop={desktop}
            prevMobile={prevMobile}
            prevDesktop={prevDesktop}
            history={historyBySite[site.id] || []}
          />
        ))}
      </div>

      {/* Activity feed */}
      <div className="mt-8">
        <ActivityFeed activity={activity} />
      </div>
    </PageShell>
  );
}

function todayEyebrow() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function BoltIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}
