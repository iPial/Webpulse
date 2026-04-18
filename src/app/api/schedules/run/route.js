import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { runPageSpeedAudit, formatAuditSummary, detectRegression } from '@/lib/pagespeed';
import { saveScanResult, upsertMonthlySnapshot, getTeamIntegrations } from '@/lib/db';
import { sendSlackMessage, buildDailySummary } from '@/lib/slack';
import { sendReportEmail, buildReportHTML } from '@/lib/email';

// POST /api/schedules/run
// Runs scans INLINE (no QStash dependency).
// Body: { scheduleId } — run a specific schedule
// Or no body — run all pending schedules where scheduledAt <= now
// This endpoint may also be called by QStash via `notBefore` delayed delivery.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scheduleId } = body;
    const supabase = createServiceSupabase();

    let schedules;

    if (scheduleId) {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('id', scheduleId)
        .eq('type', 'schedule')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }
      schedules = [data];
    } else {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'schedule')
        .eq('enabled', true);

      if (error) throw error;

      const now = new Date();
      schedules = (data || []).filter((s) => {
        const cfg = s.config || {};
        return cfg.status === 'pending' && cfg.scheduledAt && new Date(cfg.scheduledAt) <= now;
      });
    }

    if (schedules.length === 0) {
      return NextResponse.json({ message: 'No schedules to run', count: 0 });
    }

    const results = [];

    for (const schedule of schedules) {
      const outcome = await runScheduleInline(supabase, schedule);
      results.push(outcome);

      // For recurring schedules, create the next occurrence
      if (outcome.status === 'completed') {
        await handleRecurrence(supabase, schedule).catch((err) => {
          console.error('Failed to create next recurrence:', err);
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} schedule(s)`,
      results,
    });
  } catch (error) {
    console.error('Schedule run error:', error);
    return NextResponse.json(
      { error: 'Failed to run schedules', details: error.message },
      { status: 500 }
    );
  }
}

// Run one schedule inline: scan sites, send notifications, update status.
async function runScheduleInline(supabase, schedule) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};

  // Mark as running
  await supabase
    .from('integrations')
    .update({ config: { ...cfg, status: 'running' } })
    .eq('id', scheduleId);

  try {
    // Get the team's PageSpeed API key
    const { data: psiConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', teamId)
      .eq('type', 'pagespeed')
      .eq('enabled', true)
      .maybeSingle();

    const apiKey = psiConfig?.config?.apiKey || process.env.GOOGLE_PSI_API_KEY;
    if (!apiKey) {
      throw new Error('No PageSpeed API key configured. Add one in Settings > Integrations.');
    }

    // Get enabled sites for this team
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, url, name, team_id')
      .eq('team_id', teamId)
      .eq('enabled', true);

    if (sitesError) throw sitesError;

    if (!sites || sites.length === 0) {
      await supabase
        .from('integrations')
        .update({
          config: { ...cfg, status: 'completed', completedAt: new Date().toISOString(), note: 'No sites to scan' },
        })
        .eq('id', scheduleId);

      return { scheduleId, status: 'completed', sitesScanned: 0, note: 'No sites to scan' };
    }

    // Scan every site × both strategies in parallel
    const scanJobs = [];
    for (const site of sites) {
      scanJobs.push(scanSiteStrategy(site, 'mobile', apiKey));
      scanJobs.push(scanSiteStrategy(site, 'desktop', apiKey));
    }

    const scanResults = await Promise.allSettled(scanJobs);

    // Count successes/failures
    const succeeded = scanResults.filter((r) => r.status === 'fulfilled').length;
    const failed = scanResults.filter((r) => r.status === 'rejected').length;

    // Collect successful scans for notifications
    const successfulScans = scanResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    // Build siteResults map for Slack/email formatters
    const siteResults = new Map();
    for (const scan of successfulScans) {
      if (!siteResults.has(scan.siteId)) {
        siteResults.set(scan.siteId, { site: scan.site, results: {} });
      }
      siteResults.get(scan.siteId).results[scan.strategy] = scan.row;
    }

    // Detect regressions (mobile only, compare to previous monthly snapshot)
    const regressions = await detectAllRegressions(supabase, siteResults);

    // Send notifications based on schedule preferences
    const baseUrl = getPublicBaseUrl();
    const notifications = await sendNotifications(supabase, teamId, siteResults, regressions, {
      notifySlack: cfg.notifySlack,
      notifyEmail: cfg.notifyEmail,
      baseUrl,
    });

    // Update schedule status to completed
    await supabase
      .from('integrations')
      .update({
        config: {
          ...cfg,
          status: 'completed',
          completedAt: new Date().toISOString(),
          sitesScanned: succeeded,
          scanFailures: failed,
        },
      })
      .eq('id', scheduleId);

    return {
      scheduleId,
      status: 'completed',
      sitesScanned: succeeded,
      scanFailures: failed,
      notifications,
    };
  } catch (err) {
    console.error(`Schedule ${scheduleId} failed:`, err);

    await supabase
      .from('integrations')
      .update({
        config: { ...cfg, status: 'failed', error: err.message, failedAt: new Date().toISOString() },
      })
      .eq('id', scheduleId);

    return { scheduleId, status: 'failed', error: err.message };
  }
}

// Scan one site × strategy, save result, return the scan data
async function scanSiteStrategy(site, strategy, apiKey) {
  const result = await runPageSpeedAudit(site.url, strategy, { apiKey });

  const row = await saveScanResult({
    siteId: site.id,
    strategy,
    scores: result.scores,
    vitals: result.vitals,
    audits: result.audits,
  });

  // Upsert monthly snapshot (mobile only — primary metric)
  if (strategy === 'mobile') {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const summary = formatAuditSummary(result.audits);

    await upsertMonthlySnapshot({
      siteId: site.id,
      month,
      scores: result.scores,
      counts: {
        critical: summary.criticalCount,
        improvement: summary.improvementCount,
        optional: summary.optionalCount,
      },
      avgVitals: {
        fcpMs: result.vitals.fcpMs != null ? Math.round(result.vitals.fcpMs) : null,
        lcpMs: result.vitals.lcpMs != null ? Math.round(result.vitals.lcpMs) : null,
      },
    });
  }

  // Return the DB row (with scores + audits) shaped like scan_results table
  return {
    siteId: site.id,
    site,
    strategy,
    row: {
      site_id: site.id,
      strategy,
      performance: result.scores.performance,
      accessibility: result.scores.accessibility,
      best_practices: result.scores.bestPractices,
      seo: result.scores.seo,
      fcp: result.vitals.fcp,
      lcp: result.vitals.lcp,
      tbt: result.vitals.tbt,
      cls: result.vitals.cls,
      si: result.vitals.si,
      audits: result.audits,
    },
  };
}

async function detectAllRegressions(supabase, siteResults) {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const regressions = [];
  for (const [siteId, { site, results: siteData }] of siteResults) {
    const mobile = siteData.mobile;
    if (!mobile) continue;

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
          performance: mobile.performance,
          accessibility: mobile.accessibility,
          bestPractices: mobile.best_practices,
          seo: mobile.seo,
        },
        prevSnapshot
      );

      if (siteRegressions.length > 0) {
        regressions.push({ site, regressions: siteRegressions });
      }
    }
  }

  return regressions;
}

async function sendNotifications(supabase, teamId, siteResults, regressions, { notifySlack, notifyEmail, baseUrl }) {
  const integrations = await getTeamIntegrations(teamId);
  const sent = [];

  if (notifySlack) {
    const slack = integrations.find((i) => i.type === 'slack' && i.enabled);
    if (slack?.config?.webhookUrl) {
      try {
        const message = buildDailySummary(siteResults, regressions, { baseUrl });
        await sendSlackMessage(slack.config.webhookUrl, message);
        sent.push('slack');
      } catch (err) {
        console.error('Slack notification failed:', err.message);
        sent.push(`slack-failed: ${err.message}`);
      }
    } else {
      sent.push('slack-skipped: no webhook configured');
    }
  }

  if (notifyEmail) {
    try {
      const emailIntegration = integrations.find((i) => i.type === 'email' && i.enabled);
      const recipientSet = new Set();

      if (emailIntegration?.config?.emails) {
        emailIntegration.config.emails.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
      }
      if (recipientSet.size === 0 && process.env.EMAIL_TO) {
        process.env.EMAIL_TO.split(',').map((e) => e.trim()).forEach((e) => recipientSet.add(e));
      }

      const emailSites = [];
      for (const [, { site, results: siteData }] of siteResults) {
        emailSites.push({ site, mobile: siteData.mobile || null, desktop: siteData.desktop || null });
      }

      const recipients = Array.from(recipientSet);
      if (recipients.length > 0 && emailSites.length > 0) {
        const html = buildReportHTML(emailSites, { baseUrl });
        const date = new Date().toISOString().slice(0, 10);
        await sendReportEmail({
          to: recipients,
          subject: `Webpulse Report — ${date}`,
          html,
        });
        sent.push('email');
      } else if (recipients.length === 0) {
        sent.push('email-skipped: no recipients');
      }
    } catch (err) {
      console.error('Email notification failed:', err.message);
      sent.push(`email-failed: ${err.message}`);
    }
  }

  return sent;
}

// Get the public URL for building links in notifications
function getPublicBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return '';
}

// For recurring schedules, create the next occurrence
async function handleRecurrence(supabase, schedule) {
  const { frequency, scheduledAt, notifySlack, notifyEmail, createdBy } = schedule.config;

  if (!frequency || frequency === 'once') return;

  const current = new Date(scheduledAt);
  let next;

  switch (frequency) {
    case 'daily':
      next = new Date(current);
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next = new Date(current);
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return;
  }

  // If the "next" time is still in the past (e.g., daily schedule that slipped),
  // advance it forward in increments until it's in the future
  const nowMs = Date.now();
  while (next.getTime() <= nowMs) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  }

  // Create next occurrence record
  const { data: newSchedule, error } = await supabase
    .from('integrations')
    .insert({
      team_id: schedule.team_id,
      type: 'schedule',
      config: {
        scheduledAt: next.toISOString(),
        frequency,
        notifySlack: !!notifySlack,
        notifyEmail: !!notifyEmail,
        status: 'pending',
        createdBy,
      },
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create next recurrence:', error);
    return;
  }

  // Try to enqueue the QStash delayed job for auto-firing (best-effort)
  try {
    const { enqueueScheduleFire } = await import('@/lib/queue');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    if (baseUrl && newSchedule) {
      const fullUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
      await enqueueScheduleFire(newSchedule.id, next, fullUrl);
    }
  } catch (err) {
    console.error('Failed to enqueue next recurrence delayed job:', err.message);
    // Not fatal — the fallback cron will still pick it up
  }
}
