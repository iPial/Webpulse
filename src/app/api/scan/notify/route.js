import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/queue';
import { getTeamIntegrations } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { detectRegression } from '@/lib/pagespeed';
import { sendSlackMessage, buildDailySummary, buildDailySummaryText } from '@/lib/slack';

// POST /api/scan/notify
// Called by QStash after scan jobs complete
// Sends Slack summary and checks for regression alerts
export async function POST(request) {
  let body;

  try {
    body = await verifyQStashSignature(request);
  } catch (error) {
    console.error('QStash verification failed:', error.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamSiteMap } = body;
  if (!teamSiteMap) {
    return NextResponse.json({ error: 'Missing teamSiteMap' }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();
    const notificationsSent = [];

    for (const [teamId, siteIds] of Object.entries(teamSiteMap)) {
      // Get latest results for these sites
      const { data: results, error: resultsError } = await supabase
        .from('scan_results')
        .select(`
          *,
          sites (id, name, url)
        `)
        .in('site_id', siteIds)
        .order('scanned_at', { ascending: false })
        .limit(siteIds.length * 4);

      if (resultsError) {
        console.error(`Failed to fetch results for team ${teamId}:`, resultsError);
        continue;
      }

      // Deduplicate: latest per site+strategy
      const latest = new Map();
      for (const row of results) {
        const key = `${row.site_id}-${row.strategy}`;
        if (!latest.has(key)) {
          latest.set(key, row);
        }
      }

      // Group by site for summary
      const siteResults = new Map();
      for (const row of latest.values()) {
        if (!siteResults.has(row.site_id)) {
          siteResults.set(row.site_id, { site: row.sites, results: {} });
        }
        siteResults.get(row.site_id).results[row.strategy] = row;
      }

      // Check for regressions
      const now = new Date();
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

      const regressions = [];
      for (const [siteId, { site, results: siteData }] of siteResults) {
        const mobileResult = siteData.mobile;
        if (!mobileResult) continue;

        const { data: prevSnapshot, error: snapError } = await supabase
          .from('monthly_snapshots')
          .select('*')
          .eq('site_id', siteId)
          .lt('month', month)
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (snapError) {
          console.error(`Failed to fetch snapshot for site ${siteId}:`, snapError);
          continue;
        }

        if (prevSnapshot) {
          const siteRegressions = detectRegression(
            {
              performance: mobileResult.performance,
              accessibility: mobileResult.accessibility,
              bestPractices: mobileResult.best_practices,
              seo: mobileResult.seo,
            },
            prevSnapshot
          );

          if (siteRegressions.length > 0) {
            regressions.push({ site, regressions: siteRegressions });
          }
        }
      }

      // Get team integrations and send notifications
      const integrations = await getTeamIntegrations(teamId);

      for (const integration of integrations) {
        if (integration.type === 'slack' && integration.config?.webhookUrl) {
          try {
            // Use Block Kit format, fall back to text-only
            const message = integration.config.useBlocks !== false
              ? buildDailySummary(siteResults, regressions)
              : buildDailySummaryText(siteResults, regressions);

            await sendSlackMessage(integration.config.webhookUrl, message);
            notificationsSent.push({ teamId, type: 'slack' });
          } catch (err) {
            console.error(`Slack notification failed for team ${teamId}:`, err.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent,
    });
  } catch (error) {
    console.error('Notify error:', error);
    return NextResponse.json(
      { error: 'Notification failed', details: error.message },
      { status: 500 }
    );
  }
}
