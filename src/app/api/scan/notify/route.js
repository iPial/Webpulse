import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/queue';
import { getTeamIntegrations } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { detectRegression } from '@/lib/pagespeed';
import { sendSlackMessage, buildDailySummary, buildDailySummaryText } from '@/lib/slack';
import { sendReportEmail, buildReportHTML } from '@/lib/email';
import { runCompactAIForSites } from '@/lib/ai-batch';
import { logEvent } from '@/lib/logs';

// POST /api/scan/notify
// Called by QStash after scan jobs complete
// Sends Slack summary and checks for regression alerts
// Supports optional notifySlack/notifyEmail flags from scheduled scans
export async function POST(request) {
  let body;

  try {
    body = await verifyQStashSignature(request);
  } catch (error) {
    console.error('QStash verification failed:', error.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    teamSiteMap,
    notifySlack: scheduleNotifySlack,
    notifyEmail: scheduleNotifyEmail,
    notifyAI: scheduleNotifyAI,
    scheduleId,
  } = body;
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

      // Get team integrations
      const integrations = await getTeamIntegrations(teamId);

      const shouldSendSlack = scheduleNotifySlack !== undefined ? scheduleNotifySlack : true;
      const shouldSendEmail = scheduleNotifyEmail !== undefined ? scheduleNotifyEmail : false;
      const shouldRunAI = scheduleNotifyAI === true;

      const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

      // Run AI in parallel per site if requested (and log it)
      let aiSummariesBySiteId = null;
      if (shouldRunAI && siteResults.size > 0) {
        const aiStart = Date.now();
        try {
          aiSummariesBySiteId = await runCompactAIForSites(teamId, siteResults);
          await logEvent({
            teamId, type: 'ai', level: 'info',
            message: `Notify AI phase done for ${siteResults.size} site(s) in ${Date.now() - aiStart}ms`,
            metadata: {
              scheduleId,
              durationMs: Date.now() - aiStart,
              sites: siteResults.size,
              aiSites: aiSummariesBySiteId ? Object.keys(aiSummariesBySiteId).length : 0,
            },
          });
        } catch (err) {
          await logEvent({
            teamId, type: 'ai', level: 'error',
            message: `AI run failed in notify: ${err.message}`,
            metadata: { scheduleId, error: err.message },
          });
        }
      }

      if (shouldSendSlack) {
        for (const integration of integrations) {
          if (integration.type === 'slack' && integration.config?.webhookUrl) {
            try {
              const message = integration.config.useBlocks !== false
                ? buildDailySummary(siteResults, regressions, { baseUrl: publicBaseUrl, aiSummariesBySiteId })
                : buildDailySummaryText(siteResults, regressions, { baseUrl: publicBaseUrl, aiSummariesBySiteId });

              await sendSlackMessage(integration.config.webhookUrl, message);
              notificationsSent.push({ teamId, type: 'slack' });
              await logEvent({
                teamId, type: 'notification', level: 'info',
                message: `Slack report sent (${siteResults.size} site${siteResults.size !== 1 ? 's' : ''})`,
                metadata: { scheduleId, sites: siteResults.size, withAI: !!aiSummariesBySiteId },
              });
            } catch (err) {
              await logEvent({
                teamId, type: 'notification', level: 'error',
                message: `Slack send failed: ${err.message}`,
                metadata: { scheduleId, error: err.message },
              });
            }
          }
        }
      }

      if (shouldSendEmail) {
        try {
          const emailSites = [];
          for (const [, { site, results: siteData }] of siteResults) {
            emailSites.push({
              site,
              mobile: siteData.mobile || null,
              desktop: siteData.desktop || null,
            });
          }

          const recipientSet = new Set();
          const emailIntegration = integrations.find((i) => i.type === 'email' && i.enabled);
          if (emailIntegration?.config?.emails) {
            emailIntegration.config.emails.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
          }
          if (recipientSet.size === 0 && process.env.EMAIL_TO) {
            process.env.EMAIL_TO.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
          }

          const recipients = Array.from(recipientSet);
          if (recipients.length > 0 && emailSites.length > 0) {
            const html = buildReportHTML(emailSites, { baseUrl: publicBaseUrl, aiSummariesBySiteId });
            const date = new Date().toISOString().slice(0, 10);
            await sendReportEmail({
              to: recipients,
              subject: `Webpulse Report — ${date}`,
              html,
            });
            notificationsSent.push({ teamId, type: 'email' });
            await logEvent({
              teamId, type: 'notification', level: 'info',
              message: `Email sent to ${recipients.length} recipient(s)`,
              metadata: { scheduleId, recipients: recipients.length, withAI: !!aiSummariesBySiteId },
            });
          }
        } catch (err) {
          await logEvent({
            teamId, type: 'notification', level: 'error',
            message: `Email send failed: ${err.message}`,
            metadata: { scheduleId, error: err.message },
          });
        }
      }
    }

    // Update schedule status to completed if this was triggered by a schedule
    if (scheduleId) {
      try {
        const { data: schedule } = await supabase
          .from('integrations')
          .select('config')
          .eq('id', scheduleId)
          .single();

        if (schedule) {
          await supabase
            .from('integrations')
            .update({ config: { ...schedule.config, status: 'completed', completedAt: new Date().toISOString() } })
            .eq('id', scheduleId);
        }
      } catch (err) {
        console.error(`Failed to update schedule ${scheduleId} status:`, err.message);
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
