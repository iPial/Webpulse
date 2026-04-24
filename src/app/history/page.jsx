import { cookies } from 'next/headers';
import Link from 'next/link';
import { ensureTeam, getSites, getSiteHistory, getLatestResults } from '@/lib/db';
import SitePills from '@/components/SitePills';
import HistoryTable from '@/components/HistoryTable';
import PageShell from '@/components/ui/PageShell';
import Topbar from '@/components/ui/Topbar';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';
import BentoGrid from '@/components/ui/BentoGrid';
import LineChart from '@/components/ui/charts/LineChart';

export default async function HistoryPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();

  const team = await ensureTeam(cookieStore);
  const sites = await getSites(cookieStore, team.id);

  if (sites.length === 0) {
    return (
      <PageShell>
        <Topbar
          eyebrow="Trends"
          title="History"
          subtitle="Month-over-month signals, diffs and deltas."
        />
        <Card variant="hairline" className="text-center py-12">
          <p className="text-[14px] text-muted mb-4">
            Add sites in Settings to start tracking history.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center px-4 py-2 rounded-r-pill bg-ink text-surface text-[13px] font-medium shadow-ink hover:brightness-110"
          >
            Go to Settings
          </Link>
        </Card>
      </PageShell>
    );
  }

  const latestResults = await getLatestResults(cookieStore, team.id);
  const latestScores = {};
  for (const row of latestResults) {
    if (row.strategy === 'mobile' && !latestScores[row.site_id]) {
      latestScores[row.site_id] = row.performance;
    }
  }

  const siteId = resolvedParams.siteId
    ? parseInt(resolvedParams.siteId, 10)
    : sites[0].id;

  const currentSite = sites.find((s) => s.id === siteId) || sites[0];
  const history = await getSiteHistory(cookieStore, currentSite.id, { limit: 12 });

  const latest = history[0];
  const oldest = history[history.length - 1];
  const perfChange = latest && oldest ? latest.performance - oldest.performance : null;

  // Score trend data — reverse so oldest is first on the x-axis
  const reversed = [...history].reverse();
  const labels = reversed.map((r) => r.month);
  const scoreSeries = [
    { name: 'Perf', color: '#FF5C35', points: reversed.map((r) => r.performance ?? 0) },
    { name: 'A11y', color: '#F59E0B', points: reversed.map((r) => r.accessibility ?? 0) },
    { name: 'BP', color: '#0EA86B', points: reversed.map((r) => r.best_practices ?? 0) },
    { name: 'SEO', color: '#7B5CFF', points: reversed.map((r) => r.seo ?? 0) },
  ];

  const vitalsRows = reversed.filter((r) => r.avg_fcp_ms || r.avg_lcp_ms);
  const vitalsLabels = vitalsRows.map((r) => r.month);
  const vitalsSeries = vitalsRows.length
    ? [
        {
          name: 'FCP',
          color: '#BEE5FF',
          points: vitalsRows.map((r) => (r.avg_fcp_ms ? +(r.avg_fcp_ms / 1000).toFixed(1) : 0)),
        },
        {
          name: 'LCP',
          color: '#D6FF3C',
          points: vitalsRows.map((r) => (r.avg_lcp_ms ? +(r.avg_lcp_ms / 1000).toFixed(1) : 0)),
        },
      ]
    : [];

  // KPI summary
  const openIssues =
    (latest?.critical_count ?? 0) + (latest?.improvement_count ?? 0);
  const perfDeltaPill =
    perfChange !== null && perfChange !== 0
      ? { text: `${perfChange > 0 ? '▲' : '▼'} ${Math.abs(perfChange)} vs ${oldest.month}`, variant: perfChange > 0 ? 'good' : 'bad' }
      : null;

  return (
    <PageShell>
      <Topbar
        eyebrow="Trends"
        title="History"
        subtitle="Month-over-month signals, diffs and deltas."
        actions={
          <SitePills
            sites={sites}
            currentSiteId={currentSite.id}
            latestScores={latestScores}
          />
        }
      />

      <BentoGrid>
        {/* KPI cards */}
        <Card span={3}>
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Current · Perf
          </span>
          <span
            className={`font-serif text-[40px] md:text-[56px] leading-none tracking-tight ${
              latest?.performance >= 90
                ? 'text-good'
                : latest?.performance >= 50
                ? 'text-warn'
                : 'text-bad'
            }`}
          >
            {latest?.performance ?? '—'}
          </span>
          <span className="text-[12px] text-muted">Mobile, latest month</span>
          {perfDeltaPill && (
            <Pill variant={perfDeltaPill.variant} className="self-start mt-2">
              {perfDeltaPill.text}
            </Pill>
          )}
        </Card>

        <Card variant="lime" span={3}>
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: '#364503' }}>
            Period
          </span>
          <span className="font-serif text-[28px] leading-tight mt-2 text-lime-ink">
            {oldest ? `${oldest.month} → ${latest.month}` : 'No data yet'}
          </span>
          <span className="text-[12px]" style={{ color: '#364503' }}>
            {history.length} month{history.length === 1 ? '' : 's'} of data
          </span>
        </Card>

        <Card span={3}>
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Avg LCP · latest
          </span>
          <span
            className={`font-serif text-[40px] md:text-[56px] leading-none tracking-tight ${
              latest?.avg_lcp_ms && latest.avg_lcp_ms <= 2500
                ? 'text-good'
                : latest?.avg_lcp_ms && latest.avg_lcp_ms <= 4000
                ? 'text-warn'
                : 'text-bad'
            }`}
          >
            {latest?.avg_lcp_ms ? (latest.avg_lcp_ms / 1000).toFixed(1) + 's' : '—'}
          </span>
          <span className="text-[12px] text-muted">Core Web Vital</span>
        </Card>

        <Card span={3}>
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Open issues
          </span>
          <span className="font-serif text-[40px] md:text-[56px] leading-none tracking-tight text-warn">
            {openIssues}
          </span>
          <span className="text-[12px] text-muted">Critical + improvement · latest</span>
        </Card>

        {/* Score trend chart */}
        <Card span={vitalsSeries.length ? 8 : 12}>
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-[15px] text-ink">Score trend</h3>
              <p className="text-[12px] text-muted mt-0.5">
                Performance, A11y, Best Practices, SEO — month over month
              </p>
            </div>
          </div>
          {history.length >= 2 ? (
            <>
              <LineChart series={scoreSeries} labels={labels} min={0} max={105} height={260} />
              <div className="flex flex-wrap items-center gap-[14px] text-[12px] mt-3">
                <LegendItem color="#FF5C35" label="Performance" />
                <LegendItem color="#F59E0B" label="Accessibility" />
                <LegendItem color="#0EA86B" label="Best Practices" />
                <LegendItem color="#7B5CFF" label="SEO" />
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted py-8 text-center">
              Need at least 2 months of data to show a trend.
            </p>
          )}
        </Card>

        {/* CWV trend chart */}
        {vitalsSeries.length > 0 && (
          <Card variant="ink" span={4}>
            <h3 className="font-semibold text-[15px] text-surface">Core Web Vitals</h3>
            <p className="text-[12px] mt-0.5" style={{ color: '#A4A0AB' }}>
              FCP &amp; LCP in seconds · lower is better
            </p>
            <LineChart
              series={vitalsSeries}
              labels={vitalsLabels}
              min={0}
              max={Math.max(25, ...vitalsSeries.flatMap((s) => s.points)) + 2}
              height={180}
              background="ink"
              className="mt-4"
            />
            <div className="flex flex-wrap items-center gap-[14px] text-[12px] mt-3" style={{ color: '#A4A0AB' }}>
              <LegendItem color="#BEE5FF" label="FCP" dark />
              <LegendItem color="#D6FF3C" label="LCP" dark />
            </div>
          </Card>
        )}

        {/* Monthly breakdown table */}
        <div className="col-span-12">
          <HistoryTable data={history} />
        </div>
      </BentoGrid>
    </PageShell>
  );
}

function LegendItem({ color, label, dark }) {
  return (
    <span className={`inline-flex items-center gap-[6px] ${dark ? '' : 'text-muted'}`}>
      <span
        className="w-[10px] h-[10px] rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
