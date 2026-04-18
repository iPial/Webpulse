import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getLatestResults, getTeamIntegrations } from '@/lib/db';
import { createServerSupabase } from '@/lib/supabase';
import { sendReportEmail, buildReportHTML } from '@/lib/email';

// POST /api/export/email
// Body: { teamId?, to? }
// Sends to: configured integration emails + the requesting user's email
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();

    // Get the current user's email
    const supabase = createServerSupabase(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email;

    // Determine team
    let teamId = body.teamId;
    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    // Build recipients: configured list + current user
    const recipientSet = new Set();

    if (body.to) {
      const explicit = Array.isArray(body.to) ? body.to : body.to.split(',').map((e) => e.trim());
      explicit.forEach((e) => recipientSet.add(e));
    } else {
      // From email integration config
      const integrations = await getTeamIntegrations(teamId);
      const emailIntegration = integrations.find((i) => i.type === 'email' && i.enabled);

      if (emailIntegration?.config?.emails) {
        emailIntegration.config.emails.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
      }

      // Fallback to env var
      if (recipientSet.size === 0 && process.env.EMAIL_TO) {
        process.env.EMAIL_TO.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
      }
    }

    // Always include the requesting user's email
    if (userEmail) {
      recipientSet.add(userEmail);
    }

    const recipients = Array.from(recipientSet);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found. Set up email integration or sign in with an email account.' },
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
    const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    const html = buildReportHTML(sites, { baseUrl: publicBaseUrl });
    const date = new Date().toISOString().slice(0, 10);

    const data = await sendReportEmail({
      to: recipients,
      subject: `Webpulse Report — ${date}`,
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
