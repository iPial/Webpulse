import { cookies } from 'next/headers';
import Link from 'next/link';
import { ensureTeam, getLatestResults, getRecentActivity, getSiteHistoryForOverview } from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import SiteReportCard from '@/components/SiteReportCard';
import OverviewActions from '@/components/OverviewActions';
import ActivityFeed from '@/components/ActivityFeed';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageShell>
        <EmptyState message="Sign in to view your dashboard." />
      </PageShell>
    );
  }

  const team = await ensureTeam(cookieStore);
  const [results, activity, historyBySite] = await Promise.all([
    getLatestResults(cookieStore, team.id),
    getRecentActivity(cookieStore, team.id),
    getSiteHistoryForOverview(cookieStore, team.id, { days: 14 }),
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
    return (
      <PageShell>
        <Topbar eyebrow={todayEyebrow()} title="Overview" />
        <EmptyState message="No scan results yet. Add sites in Settings and run your first scan." showSetup />
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
                <span className="font-serif text-[88px] leading-none tracking-tight text-lime">
                  {totalCritical}
                </span>
                <span className="font-serif text-[24px] text-surface/80">
                  critical issue{totalCritical !== 1 ? 's' : ''} across all sites
                </span>
              </div>
              <p className="text-[14px] mt-3 max-w-[520px]" style={{ color: '#A4A0AB' }}>
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
        {sites.map(({ site, mobile, desktop, prevMobile }) => (
          <SiteReportCard
            key={site.id}
            site={site}
            mobile={mobile}
            desktop={desktop}
            prevMobile={prevMobile}
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

function EmptyState({ message, showSetup }) {
  return (
    <Card variant="hairline" className="text-center py-12 mt-8">
      <div className="mx-auto w-[56px] h-[56px] rounded-full bg-paper-2 grid place-items-center mb-3">
        <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      </div>
      <p className="text-[14px] text-muted mb-4">{message}</p>
      {showSetup && (
        <Link
          href="/settings"
          className="inline-flex items-center px-4 py-2 rounded-r-pill bg-ink text-surface text-[13px] font-medium shadow-ink hover:brightness-110"
        >
          Go to Settings
        </Link>
      )}
    </Card>
  );
}
