import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getLatestResults, getTeamIntegrations } from '@/lib/db';
import { sendSlackMessage, buildDailySummary } from '@/lib/slack';
import { runCompactAIForSites } from '@/lib/ai-batch';
import { logEvent } from '@/lib/logs';

// POST /api/export/slack
// Body: { teamId?, includeAI? (default true) }
// Sends the latest scan report to Slack on demand.
// Includes AI top fixes if an AI provider is configured for the team.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json().catch(() => ({}));
    const includeAI = body.includeAI !== false;

    let teamId = body.teamId;
    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    // Get Slack webhook
    const integrations = await getTeamIntegrations(teamId);
    const slackIntegration = integrations.find((i) => i.type === 'slack' && i.enabled);
    const webhookUrl = slackIntegration?.config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'No Slack webhook configured. Add one in Settings > Integrations.' },
        { status: 400 }
      );
    }

    // Fetch latest results
    const results = await getLatestResults(cookieStore, teamId);
    if (results.length === 0) {
      return NextResponse.json({ error: 'No scan results to report' }, { status: 404 });
    }

    // Group by site — shape matches what runCompactAIForSites + buildDailySummary expect
    const siteResults = new Map();
    for (const row of results) {
      if (!siteResults.has(row.site_id)) {
        siteResults.set(row.site_id, { site: row.sites, results: {} });
      }
      siteResults.get(row.site_id).results[row.strategy] = row;
    }

    const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    // Run AI in best-effort mode — never block the Slack send if it fails
    let aiSummariesBySiteId = null;
    if (includeAI) {
      try {
        aiSummariesBySiteId = await runCompactAIForSites(teamId, siteResults);
      } catch (err) {
        console.error('runCompactAIForSites failed in export/slack:', err.message);
        await logEvent({
          teamId,
          type: 'ai',
          level: 'warn',
          message: `AI enrichment skipped for manual Slack send: ${err.message}`,
          metadata: { error: err.message },
        });
      }
    }

    const message = buildDailySummary(siteResults, [], {
      baseUrl: publicBaseUrl,
      aiSummariesBySiteId,
    });
    await sendSlackMessage(webhookUrl, message);

    await logEvent({
      teamId,
      type: 'notification',
      level: 'info',
      message: 'Manual Slack report sent',
      metadata: {
        sitesIncluded: siteResults.size,
        withAI: !!aiSummariesBySiteId,
        aiSitesCount: aiSummariesBySiteId ? Object.keys(aiSummariesBySiteId).length : 0,
      },
    });

    return NextResponse.json({ success: true, withAI: !!aiSummariesBySiteId });
  } catch (error) {
    console.error('Slack export error:', error);
    return NextResponse.json(
      { error: 'Failed to send Slack report', details: error.message },
      { status: 500 }
    );
  }
}
