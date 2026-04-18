import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getLatestResults, getTeamIntegrations } from '@/lib/db';
import { sendSlackMessage, buildDailySummary } from '@/lib/slack';

// POST /api/export/slack
// Body: { teamId? }
// Sends a scan report to Slack on demand
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();

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

    // Group by site
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

    const message = buildDailySummary(siteResults, [], { baseUrl: publicBaseUrl });
    await sendSlackMessage(webhookUrl, message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slack export error:', error);
    return NextResponse.json(
      { error: 'Failed to send Slack report', details: error.message },
      { status: 500 }
    );
  }
}
