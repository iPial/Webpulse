import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getLatestResults, getTeamIntegrations } from '@/lib/db';
import { sendReportEmail, buildReportHTML } from '@/lib/email';

// POST /api/export/email
// Body: { teamId?, to? }
// Sends a scan report email. Uses integration config or provided recipients.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();

    // Determine team
    let teamId = body.teamId;
    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    // Determine recipients
    let recipients = [];

    if (body.to) {
      // Explicit recipients from request
      recipients = Array.isArray(body.to) ? body.to : body.to.split(',').map((e) => e.trim());
    } else {
      // Check email integration config
      const integrations = await getTeamIntegrations(teamId);
      const emailIntegration = integrations.find((i) => i.type === 'email' && i.enabled);

      if (emailIntegration?.config?.emails) {
        recipients = emailIntegration.config.emails.split(',').map((e) => e.trim());
      }

      // Fallback to env var
      if (recipients.length === 0 && process.env.EMAIL_TO) {
        recipients = process.env.EMAIL_TO.split(',').map((e) => e.trim());
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients configured. Set up email integration or provide "to" in request.' },
        { status: 400 }
      );
    }

    // Fetch latest results
    const results = await getLatestResults(cookieStore, teamId);

    if (results.length === 0) {
      return NextResponse.json({ error: 'No scan results to report' }, { status: 404 });
    }

    // Group by site
    const siteMap = new Map();
    for (const row of results) {
      if (!siteMap.has(row.site_id)) {
        siteMap.set(row.site_id, { site: row.sites, mobile: null, desktop: null });
      }
      siteMap.get(row.site_id)[row.strategy] = row;
    }
    const sites = Array.from(siteMap.values());

    // Build and send email
    const html = buildReportHTML(sites);
    const date = new Date().toISOString().slice(0, 10);

    const data = await sendReportEmail({
      to: recipients,
      subject: `PageSpeed Report — ${date}`,
      html,
    });

    return NextResponse.json({
      success: true,
      recipients,
      emailId: data?.id,
    });
  } catch (error) {
    console.error('Email export error:', error);
    return NextResponse.json(
      { error: 'Failed to send email report', details: error.message },
      { status: 500 }
    );
  }
}
