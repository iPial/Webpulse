import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { runPageSpeedAudit, formatAuditSummary, detectRegression } from '@/lib/pagespeed';
import { saveScanResult, upsertMonthlySnapshot, getTeamIntegrations } from '@/lib/db';
import { sendSlackMessage, buildDailySummary } from '@/lib/slack';
import { sendReportEmail, buildReportHTML } from '@/lib/email';
import { resolveAIConfig, callAIProvider, buildCompactPrompt, parseCompactResponse } from '@/lib/ai';
import { logEvent } from '@/lib/logs';

// POST /api/schedules/run
// Runs scans INLINE (no QStash dependency for the scan itself).
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

// Run one schedule inline: scan sites, optionally run AI, send notifications, update status.
async function runScheduleInline(supabase, schedule) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};
  const startedAt = Date.now();

  await supabase
    .from('integrations')
    .update({ config: { ...cfg, status: 'running' } })
    .eq('id', scheduleId);

  await logEvent({
    teamId,
    type: 'schedule',
    level: 'info',
    message: `Schedule #${scheduleId} run started`,
    metadata: {
      scheduleId,
      scheduledAt: cfg.scheduledAt,
      notifySlack: !!cfg.notifySlack,
      notifyEmail: !!cfg.notifyEmail,
      notifyAI: !!cfg.notifyAI,
    },
  });

  try {
    // PageSpeed API key
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

    // Enabled sites
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, url, name, team_id, tags')
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

      await logEvent({
        teamId,
        type: 'schedule',
        level: 'warn',
        message: `Schedule #${scheduleId} has no enabled sites to scan`,
        metadata: { scheduleId },
      });

      return { scheduleId, status: 'completed', sitesScanned: 0, note: 'No sites to scan' };
    }

    // Scan every site × both strategies in parallel
    const scanJobs = [];
    for (const site of sites) {
      scanJobs.push(scanSiteStrategy(site, 'mobile', apiKey, teamId));
      scanJobs.push(scanSiteStrategy(site, 'desktop', apiKey, teamId));
    }

    const scanResults = await Promise.allSettled(scanJobs);
    const succeeded = scanResults.filter((r) => r.status === 'fulfilled').length;
    const failed = scanResults.filter((r) => r.status === 'rejected').length;

    const successfulScans = scanResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    const siteResults = new Map();
    for (const scan of successfulScans) {
      if (!siteResults.has(scan.siteId)) {
        siteResults.set(scan.siteId, { site: scan.site, results: {} });
      }
      siteResults.get(scan.siteId).results[scan.strategy] = scan.row;
    }

    // Detect regressions
    const regressions = await detectAllRegressions(supabase, siteResults);

    // Optionally run AI for each site
    let aiSummariesBySiteId = null;
    if (cfg.notifyAI) {
      aiSummariesBySiteId = await runCompactAIForSites(teamId, siteResults);
    }

    // Send notifications
    const baseUrl = getPublicBaseUrl();
    const notifications = await sendNotifications(supabase, teamId, siteResults, regressions, {
      notifySlack: cfg.notifySlack,
      notifyEmail: cfg.notifyEmail,
      baseUrl,
      aiSummariesBySiteId,
    });

    // Mark completed
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

    await logEvent({
      teamId,
      type: 'schedule',
      level: 'info',
      message: `Schedule #${scheduleId} completed (${succeeded} ok, ${failed} failed)`,
      metadata: {
        scheduleId,
        sitesScanned: succeeded,
        scanFailures: failed,
        notifications,
        durationMs: Date.now() - startedAt,
      },
    });

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

    await logEvent({
      teamId,
      type: 'schedule',
      level: 'error',
      message: `Schedule #${scheduleId} failed: ${err.message}`,
      metadata: { scheduleId, error: err.message, durationMs: Date.now() - startedAt },
    });

    return { scheduleId, status: 'failed', error: err.message };
  }
}

// Scan one site × strategy, save result, return the scan data
async function scanSiteStrategy(site, strategy, apiKey, teamId) {
  const startedAt = Date.now();
  try {
    const result = await runPageSpeedAudit(site.url, strategy, { apiKey });

    await saveScanResult({
      siteId: site.id,
      strategy,
      scores: result.scores,
      vitals: result.vitals,
      audits: result.audits,
    });

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

    await logEvent({
      teamId,
      type: 'scan',
      level: 'info',
      message: `Scanned ${site.name} (${strategy}) — perf ${result.scores.performance}, a11y ${result.scores.accessibility}`,
      metadata: {
        siteId: site.id,
        siteName: site.name,
        strategy,
        scores: result.scores,
        durationMs: Date.now() - startedAt,
      },
    });

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
  } catch (err) {
    await logEvent({
      teamId,
      type: 'scan',
      level: 'error',
      message: `Scan failed for ${site.name} (${strategy}): ${err.message}`,
      metadata: {
        siteId: site.id,
        siteName: site.name,
        strategy,
        error: err.message,
        durationMs: Date.now() - startedAt,
      },
    });
    throw err;
  }
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

// Run compact AI analysis for each site that has a mobile result.
// Returns { [siteId]: { summary, topFixes } }. Failures are logged but non-fatal.
async function runCompactAIForSites(teamId, siteResults) {
  try {
    const { provider, apiKey } = await resolveAIConfig(teamId);
    if (!apiKey) {
      await logEvent({
        teamId,
        type: 'ai',
        level: 'warn',
        message: 'AI analysis skipped — no API key configured',
        metadata: { hint: 'Add AI provider key in Settings > Integrations' },
      });
      return null;
    }

    const byId = {};
    for (const [siteId, { site, results }] of siteResults) {
      const mobile = results.mobile;
      if (!mobile) continue;

      const startedAt = Date.now();
      try {
        const prompt = buildCompactPrompt(site, mobile);
        const text = await callAIProvider(provider, apiKey, prompt, 800);
        const parsed = parseCompactResponse(text);
        if (parsed) {
          byId[siteId] = parsed;
          await logEvent({
            teamId,
            type: 'ai',
            level: 'info',
            message: `AI summary generated for ${site.name}`,
            metadata: { siteId, provider, durationMs: Date.now() - startedAt, fixes: parsed.topFixes.length },
          });
        } else {
          await logEvent({
            teamId,
            type: 'ai',
            level: 'warn',
            message: `AI returned unparseable response for ${site.name}`,
            metadata: { siteId, provider, durationMs: Date.now() - startedAt, preview: text.slice(0, 120) },
          });
        }
      } catch (err) {
        await logEvent({
          teamId,
          type: 'ai',
          level: 'error',
          message: `AI call failed for ${site.name}: ${err.message}`,
          metadata: { siteId, provider, error: err.message, durationMs: Date.now() - startedAt },
        });
      }
    }

    return byId;
  } catch (err) {
    await logEvent({
      teamId,
      type: 'ai',
      level: 'error',
      message: `AI resolution failed: ${err.message}`,
      metadata: { error: err.message },
    });
    return null;
  }
}

async function sendNotifications(supabase, teamId, siteResults, regressions, { notifySlack, notifyEmail, baseUrl, aiSummariesBySiteId }) {
  const integrations = await getTeamIntegrations(teamId);
  const sent = [];

  if (notifySlack) {
    const slack = integrations.find((i) => i.type === 'slack' && i.enabled);
    if (slack?.config?.webhookUrl) {
      try {
        const message = buildDailySummary(siteResults, regressions, { baseUrl, aiSummariesBySiteId });
        await sendSlackMessage(slack.config.webhookUrl, message);
        sent.push('slack');
        await logEvent({
          teamId,
          type: 'notification',
          level: 'info',
          message: 'Slack report sent',
          metadata: { sitesIncluded: siteResults.size, withAI: !!aiSummariesBySiteId },
        });
      } catch (err) {
        sent.push(`slack-failed: ${err.message}`);
        await logEvent({
          teamId,
          type: 'notification',
          level: 'error',
          message: `Slack send failed: ${err.message}`,
          metadata: { error: err.message },
        });
      }
    } else {
      sent.push('slack-skipped: no webhook configured');
      await logEvent({
        teamId,
        type: 'notification',
        level: 'warn',
        message: 'Slack notification skipped — no webhook configured',
        metadata: {},
      });
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
        const html = buildReportHTML(emailSites, { baseUrl, aiSummariesBySiteId });
        const date = new Date().toISOString().slice(0, 10);
        await sendReportEmail({
          to: recipients,
          subject: `Webpulse Report — ${date}`,
          html,
        });
        sent.push('email');
        await logEvent({
          teamId,
          type: 'notification',
          level: 'info',
          message: `Email report sent to ${recipients.length} recipient(s)`,
          metadata: { recipients, withAI: !!aiSummariesBySiteId },
        });
      } else if (recipients.length === 0) {
        sent.push('email-skipped: no recipients');
        await logEvent({
          teamId,
          type: 'notification',
          level: 'warn',
          message: 'Email notification skipped — no recipients',
          metadata: {},
        });
      }
    } catch (err) {
      sent.push(`email-failed: ${err.message}`);
      await logEvent({
        teamId,
        type: 'notification',
        level: 'error',
        message: `Email send failed: ${err.message}`,
        metadata: { error: err.message },
      });
    }
  }

  return sent;
}

function getPublicBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return '';
}

async function handleRecurrence(supabase, schedule) {
  const { frequency, scheduledAt, notifySlack, notifyEmail, notifyAI, createdBy } = schedule.config;

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

  const nowMs = Date.now();
  while (next.getTime() <= nowMs) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  }

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
        notifyAI: !!notifyAI,
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

  await logEvent({
    teamId: schedule.team_id,
    type: 'schedule',
    level: 'info',
    message: `Next occurrence created: schedule #${newSchedule.id} for ${next.toISOString()}`,
    metadata: { newScheduleId: newSchedule.id, frequency, scheduledAt: next.toISOString() },
  });

  try {
    const { enqueueScheduleFire } = await import('@/lib/queue');
    const baseUrl = getPublicBaseUrl();
    if (baseUrl && newSchedule) {
      const result = await enqueueScheduleFire(newSchedule.id, next, baseUrl);
      await logEvent({
        teamId: schedule.team_id,
        type: 'schedule',
        level: 'info',
        message: `QStash auto-fire queued for recurring schedule #${newSchedule.id}`,
        metadata: { scheduleId: newSchedule.id, messageId: result?.messageId || null },
      });
    }
  } catch (err) {
    await logEvent({
      teamId: schedule.team_id,
      type: 'schedule',
      level: 'error',
      message: `QStash auto-fire failed for recurring schedule #${newSchedule.id}: ${err.message}`,
      metadata: { scheduleId: newSchedule.id, error: err.message },
    });
  }
}
