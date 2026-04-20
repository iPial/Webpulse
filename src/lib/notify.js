// Shared notify pipeline used by both the QStash-delivered /api/scan/notify
// endpoint and the schedule recovery path in /api/schedules/run.
//
// Inputs:
//   teamSiteMap: { [teamId]: [siteId, ...] }
//   options: { notifySlack, notifyEmail, notifyAI, scheduleId }
//
// Responsibilities:
//   1. Fetch the latest scan_results for each site.
//   2. Detect regressions vs last month.
//   3. If notifyAI, run compact AI per site.
//   4. Send Slack (with AI top fixes).
//   5. Send email (with AI top fixes).
//   6. If scheduleId provided, mark the schedule 'completed'.

import { createServiceSupabase } from './supabase';
import { getTeamIntegrations } from './db';
import { detectRegression } from './pagespeed';
import { sendSlackMessage, buildDailySummary, buildDailySummaryText } from './slack';
import { sendReportEmail, buildReportHTML } from './email';
import { runCompactAIForSites } from './ai-batch';
import { logEvent } from './logs';

export async function runNotifyPipeline(teamSiteMap, options = {}) {
  const {
    notifySlack: scheduleNotifySlack,
    notifyEmail: scheduleNotifyEmail,
    notifyAI: scheduleNotifyAI,
    scheduleId,
  } = options;

  const supabase = createServiceSupabase();
  const notificationsSent = [];

  // Only look at scan_results from the last 10 minutes so we don't
  // aggregate stale data from a previous run (the classic "notify sent
  // but sites show old scores" bug when all workers time out).
  const freshSinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  for (const [teamId, siteIds] of Object.entries(teamSiteMap)) {
    const { data: results, error: resultsError } = await supabase
      .from('scan_results')
      .select('*, sites (id, name, url, team_id, tags, logo_url)')
      .in('site_id', siteIds)
      .gte('scanned_at', freshSinceIso)
      .order('scanned_at', { ascending: false })
      .limit(siteIds.length * 4);

    if (resultsError) {
      await logEvent({
        teamId, type: 'notification', level: 'error',
        message: `Failed to fetch scan results: ${resultsError.message}`,
        metadata: { scheduleId, error: resultsError.message },
      });
      continue;
    }

    // If nothing fresh, don't send a misleading "here are your scores" message
    if (!results || results.length === 0) {
      const errorMsg =
        'PageSpeed API did not finish in Vercel Hobby\'s 60s function limit. ' +
        'Google\'s PSI genuinely takes 60-90s for heavy WordPress sites. ' +
        'Fixes: (1) Upgrade to Vercel Pro for 300s functions; ' +
        '(2) Use manual "Scan Now" on each site (separate function budget); ' +
        '(3) Scan simpler sites per schedule.';

      await logEvent({
        teamId, type: 'notification', level: 'error',
        message: `Schedule #${scheduleId}: no fresh scan results — all PSI calls exceeded 60s`,
        metadata: { scheduleId, siteIds, recommendation: 'Upgrade Vercel to Pro, or use manual scans.' },
      });

      if (scheduleId) {
        const { data: sch } = await supabase.from('integrations').select('config').eq('id', scheduleId).single();
        if (sch) {
          await supabase
            .from('integrations')
            .update({
              config: {
                ...sch.config,
                status: 'failed',
                error: errorMsg,
                failedAt: new Date().toISOString(),
              },
            })
            .eq('id', scheduleId);
        }
      }
      continue;
    }

    // Deduplicate latest per site+strategy
    const latest = new Map();
    for (const row of results || []) {
      const key = `${row.site_id}-${row.strategy}`;
      if (!latest.has(key)) latest.set(key, row);
    }

    // Group by site
    const siteResults = new Map();
    for (const row of latest.values()) {
      if (!siteResults.has(row.site_id)) {
        siteResults.set(row.site_id, { site: row.sites, results: {} });
      }
      siteResults.get(row.site_id).results[row.strategy] = row;
    }

    // Regressions vs previous monthly snapshot
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const regressions = [];
    for (const [siteId, { site, results: siteData }] of siteResults) {
      const mobileResult = siteData.mobile;
      if (!mobileResult) continue;

      const { data: prevSnapshot } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('site_id', siteId)
        .lt('month', month)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

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
        if (siteRegressions.length > 0) regressions.push({ site, regressions: siteRegressions });
      }
    }

    const integrations = await getTeamIntegrations(teamId);
    const shouldSendSlack = scheduleNotifySlack !== undefined ? scheduleNotifySlack : true;
    const shouldSendEmail = scheduleNotifyEmail !== undefined ? scheduleNotifyEmail : false;
    const shouldRunAI = scheduleNotifyAI === true;

    const publicBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

    // AI (optional)
    let aiSummariesBySiteId = null;
    if (shouldRunAI && siteResults.size > 0) {
      const aiStart = Date.now();
      try {
        aiSummariesBySiteId = await runCompactAIForSites(teamId, siteResults);
        await logEvent({
          teamId, type: 'ai', level: 'info',
          message: `Notify AI phase done (${siteResults.size} site(s)) in ${Date.now() - aiStart}ms`,
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

    // Slack
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

    // Email
    if (shouldSendEmail) {
      try {
        const emailSites = [];
        for (const [, { site, results: siteData }] of siteResults) {
          emailSites.push({ site, mobile: siteData.mobile || null, desktop: siteData.desktop || null });
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

  // Mark schedule completed if provided
  if (scheduleId) {
    try {
      const { data: schedule } = await supabase
        .from('integrations')
        .select('config, team_id')
        .eq('id', scheduleId)
        .single();
      if (schedule) {
        await supabase
          .from('integrations')
          .update({ config: { ...schedule.config, status: 'completed', completedAt: new Date().toISOString() } })
          .eq('id', scheduleId);
        await logEvent({
          teamId: schedule.team_id,
          type: 'schedule', level: 'info',
          message: `Schedule #${scheduleId} completed via notify pipeline`,
          metadata: { scheduleId, notificationsSent: notificationsSent.length },
        });
      }
    } catch (err) {
      console.error(`Failed to mark schedule ${scheduleId} completed:`, err.message);
    }
  }

  return { notificationsSent };
}
