import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getTeamIntegrations, getTrendData } from '@/lib/db';
import { sendSlackMessage, buildTrendReport } from '@/lib/slack';
import { logEvent } from '@/lib/logs';

// POST /api/export/trend-slack
// Body: { teamId? }
// Sends a 7-day trend report (vs prior 7 days) to the team's Slack webhook.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json().catch(() => ({}));

    let teamId = body.teamId;
    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    const integrations = await getTeamIntegrations(teamId);
    const slackIntegration = integrations.find((i) => i.type === 'slack' && i.enabled);
    const webhookUrl = slackIntegration?.config?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'No Slack webhook configured. Add one in Settings > Integrations.' },
        { status: 400 }
      );
    }

    const trendBySiteId = await getTrendData(cookieStore, teamId);
    if (!trendBySiteId || Object.keys(trendBySiteId).length === 0) {
      return NextResponse.json({ error: 'No trend data yet — scan at least a few days first.' }, { status: 404 });
    }

    const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : '');

    const now = Date.now();
    const message = buildTrendReport(trendBySiteId, {
      baseUrl: publicBaseUrl,
      periodStart: new Date(now - 7 * 86400000).toISOString(),
      periodEnd: new Date(now).toISOString(),
    });

    await sendSlackMessage(webhookUrl, message);

    await logEvent({
      teamId, type: 'notification', level: 'info',
      message: `Weekly trend report sent to Slack`,
      metadata: { sites: Object.keys(trendBySiteId).length },
    });

    return NextResponse.json({ success: true, sites: Object.keys(trendBySiteId).length });
  } catch (error) {
    console.error('Trend Slack export error:', error);
    return NextResponse.json(
      { error: 'Failed to send trend report', details: error.message },
      { status: 500 }
    );
  }
}
