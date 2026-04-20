import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { runPageSpeedAudit, formatAuditSummary } from '@/lib/pagespeed';
import { saveScanResult, upsertMonthlySnapshot } from '@/lib/db';
import { runNotifyPipeline } from '@/lib/notify';
import { logEvent } from '@/lib/logs';

// POST /api/schedules/run
// Body: { scheduleId } OR empty body (polls due pending + recovers stuck).
//
// Fully inline: scans N sites in parallel with a tight PSI timeout, then
// runs notify pipeline in-process. No QStash delivery involved, so a
// QStash sig-verify failure in the old worker/notify path can't leave
// the schedule stuck. Budget ~55s (fits Vercel Hobby 60s).
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
      // Recover schedules stuck for > 90s (from older code paths or partial
      // runs). If fresh scan_results exist since runStartedAt we notify
      // inline; otherwise mark failed. See recoverStuckSchedule below.
      const recoverCutoffMs = now.getTime() - 90 * 1000;
      const stuck = (data || []).filter((s) => {
        const cfg = s.config || {};
        if (cfg.status !== 'running') return false;
        if (!cfg.runStartedAt) return true;
        return new Date(cfg.runStartedAt).getTime() < recoverCutoffMs;
      });
      for (const s of stuck) {
        await recoverStuckSchedule(supabase, s);
      }

      schedules = (data || []).filter((s) => {
        const cfg = s.config || {};
        return cfg.status === 'pending' && cfg.scheduledAt && new Date(cfg.scheduledAt) <= now;
      });
    }

    if (schedules.length === 0) {
      return NextResponse.json({ message: 'No schedules to run', count: 0 });
    }

    // One schedule per invocation so each gets a full 60s budget.
    const pickOne = scheduleId ? schedules : schedules.slice(0, 1);
    const leftover = schedules.length - pickOne.length;

    const results = [];
    for (const schedule of pickOne) {
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
      deferred: leftover,
    });
  } catch (error) {
    console.error('Schedule run error:', error);
    return NextResponse.json(
      { error: 'Failed to run schedules', details: error.message },
      { status: 500 }
    );
  }
}

// Fully-inline pipeline. Budget (targeting 55s):
//   - Scan phase (parallel PSI, 40s cap per call)      → ~40s worst
//   - Notify phase (runNotifyPipeline, Promise.race 12s) → ~12s worst
//   - DB bookkeeping                                   → ~2s
// Total worst: ~54s. AI is run inside runNotifyPipeline only if schedule
// has notifyAI AND we reach notify with enough headroom.
async function runScheduleInline(supabase, schedule) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};
  const fnStart = Date.now();

  await supabase
    .from('integrations')
    .update({ config: { ...cfg, status: 'running', runStartedAt: new Date().toISOString() } })
    .eq('id', scheduleId);

  await logEvent({
    teamId, type: 'schedule', level: 'info',
    message: `Schedule #${scheduleId} run started (inline)`,
    metadata: { scheduleId, notifySlack: !!cfg.notifySlack, notifyEmail: !!cfg.notifyEmail, notifyAI: !!cfg.notifyAI },
  });

  try {
    // PSI API key
    const { data: psiConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', teamId)
      .eq('type', 'pagespeed')
      .eq('enabled', true)
      .maybeSingle();
    const apiKey = psiConfig?.config?.apiKey || process.env.GOOGLE_PSI_API_KEY;
    if (!apiKey) throw new Error('No PageSpeed API key configured. Add one in Settings > Integrations.');

    // Sites
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, url, name, team_id, tags, logo_url')
      .eq('team_id', teamId)
      .eq('enabled', true);
    if (sitesError) throw sitesError;

    if (!sites || sites.length === 0) {
      await supabase
        .from('integrations')
        .update({ config: { ...cfg, status: 'completed', completedAt: new Date().toISOString(), note: 'No sites to scan' } })
        .eq('id', scheduleId);
      await logEvent({ teamId, type: 'schedule', level: 'warn', message: `Schedule #${scheduleId} has no sites`, metadata: { scheduleId } });
      return { scheduleId, status: 'completed', sitesScanned: 0 };
    }

    // Parallel scans with a tight per-call timeout. If a site's PSI can't
    // return in 40s we accept the partial batch — better than stuck.
    const scanStart = Date.now();
    const scanJobs = [];
    for (const site of sites) {
      scanJobs.push(scanOne(site, 'mobile', apiKey, teamId));
      scanJobs.push(scanOne(site, 'desktop', apiKey, teamId));
    }
    const scanOutcomes = await Promise.allSettled(scanJobs);
    const scanMs = Date.now() - scanStart;
    const okCount = scanOutcomes.filter((o) => o.status === 'fulfilled').length;
    const failCount = scanOutcomes.filter((o) => o.status === 'rejected').length;

    await logEvent({
      teamId, type: 'schedule', level: 'info',
      message: `Schedule #${scheduleId} scan phase ${scanMs}ms (${okCount} ok, ${failCount} failed)`,
      metadata: { scheduleId, scanMs, okCount, failCount, sites: sites.length },
    });

    if (okCount === 0) {
      await supabase
        .from('integrations')
        .update({
          config: {
            ...cfg, status: 'failed',
            error: `All ${failCount} scan(s) failed. Check PSI API key and site URLs.`,
            failedAt: new Date().toISOString(),
          },
        })
        .eq('id', scheduleId);
      await logEvent({
        teamId, type: 'schedule', level: 'error',
        message: `Schedule #${scheduleId} failed: all scans errored`,
        metadata: { scheduleId, scanMs, failCount },
      });
      return { scheduleId, status: 'failed', error: 'All scans failed' };
    }

    // Notify pipeline — reads fresh scan_results from DB, runs AI if
    // notifyAI is set AND we have time, sends Slack/email, marks completed.
    // Wrapped in Promise.race with a 15s hard cap so a stuck webhook can't
    // eat the remaining budget.
    const elapsed = Date.now() - fnStart;
    const notifyBudgetMs = Math.min(15000, Math.max(5000, 58000 - elapsed));
    const siteIds = sites.map((s) => s.id);

    // Budget guard: only run AI inside the notify call if we have > 22s left
    // (AI parallel per site can take up to 18s; leave 4s for Slack/email).
    const hasAIBudget = (58000 - elapsed) > 22000;
    const effectiveNotifyAI = !!cfg.notifyAI && hasAIBudget;

    const notifyStart = Date.now();
    try {
      await Promise.race([
        runNotifyPipeline(
          { [teamId]: siteIds },
          {
            notifySlack: cfg.notifySlack,
            notifyEmail: cfg.notifyEmail,
            notifyAI: effectiveNotifyAI,
            scheduleId,
          }
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`notify phase exceeded ${notifyBudgetMs}ms`)), notifyBudgetMs)
        ),
      ]);

      // runNotifyPipeline already marks the schedule completed when it
      // finishes, so we're done.
      await logEvent({
        teamId, type: 'schedule', level: 'info',
        message: `Schedule #${scheduleId} notify phase ${Date.now() - notifyStart}ms (AI ${effectiveNotifyAI ? 'on' : 'skipped'})`,
        metadata: { scheduleId, notifyMs: Date.now() - notifyStart, aiRan: effectiveNotifyAI },
      });

      return { scheduleId, status: 'completed', sitesScanned: okCount, scanFailures: failCount };
    } catch (notifyErr) {
      // Notify failed but scans succeeded. Mark completed anyway so the
      // schedule isn't stuck — Slack/email just didn't go out this time.
      await supabase
        .from('integrations')
        .update({
          config: {
            ...cfg, status: 'completed',
            completedAt: new Date().toISOString(),
            notifyError: notifyErr.message,
            sitesScanned: okCount,
            scanFailures: failCount,
          },
        })
        .eq('id', scheduleId);
      await logEvent({
        teamId, type: 'schedule', level: 'error',
        message: `Schedule #${scheduleId} completed with notify error: ${notifyErr.message}`,
        metadata: { scheduleId, error: notifyErr.message },
      });
      return { scheduleId, status: 'completed', notifyError: notifyErr.message };
    }
  } catch (err) {
    console.error(`Schedule ${scheduleId} failed:`, err);
    await supabase
      .from('integrations')
      .update({
        config: { ...cfg, status: 'failed', error: err.message, failedAt: new Date().toISOString() },
      })
      .eq('id', scheduleId);
    await logEvent({
      teamId, type: 'schedule', level: 'error',
      message: `Schedule #${scheduleId} failed: ${err.message}`,
      metadata: { scheduleId, error: err.message, durationMs: Date.now() - fnStart },
    });
    return { scheduleId, status: 'failed', error: err.message };
  }
}

// Scan one (site × strategy). 40s PSI timeout per call. Save result + snapshot.
async function scanOne(site, strategy, apiKey, teamId) {
  const start = Date.now();
  try {
    const result = await runPageSpeedAudit(site.url, strategy, { apiKey, timeoutMs: 40000 });

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
        siteId: site.id, month, scores: result.scores,
        counts: { critical: summary.criticalCount, improvement: summary.improvementCount, optional: summary.optionalCount },
        avgVitals: {
          fcpMs: result.vitals.fcpMs != null ? Math.round(result.vitals.fcpMs) : null,
          lcpMs: result.vitals.lcpMs != null ? Math.round(result.vitals.lcpMs) : null,
        },
      });
    }

    await logEvent({
      teamId, type: 'scan', level: 'info',
      message: `Scanned ${site.name} (${strategy}) — perf ${result.scores.performance}`,
      metadata: { siteId: site.id, strategy, scores: result.scores, durationMs: Date.now() - start },
    });
    return { siteId: site.id, strategy };
  } catch (err) {
    await logEvent({
      teamId, type: 'scan', level: 'error',
      message: `Scan failed for ${site.name} (${strategy}): ${err.message}`,
      metadata: { siteId: site.id, strategy, error: err.message, durationMs: Date.now() - start },
    });
    throw err;
  }
}

// Called by the 60s poller when a schedule has been 'running' for > 90s.
// Runs notify inline if fresh scan_results exist since runStartedAt;
// otherwise marks failed.
async function recoverStuckSchedule(supabase, schedule) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};
  const runStartedAt = cfg.runStartedAt;

  try {
    const { data: sites } = await supabase
      .from('sites').select('id').eq('team_id', teamId).eq('enabled', true);
    const siteIds = (sites || []).map((s) => s.id);
    if (siteIds.length === 0) {
      await failSchedule(supabase, schedule, 'Stuck with no enabled sites.');
      await logEvent({
        teamId, type: 'schedule', level: 'error',
        message: `Reclaimed stuck schedule #${scheduleId} — no sites`,
        metadata: { scheduleId, runStartedAt },
      });
      return;
    }

    const since = runStartedAt || new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: freshResults } = await supabase
      .from('scan_results')
      .select('site_id, scanned_at')
      .in('site_id', siteIds)
      .gte('scanned_at', since)
      .limit(1);

    if (!freshResults || freshResults.length === 0) {
      await failSchedule(supabase, schedule, 'No scan results produced — function likely died mid-scan. Click Retry.');
      await logEvent({
        teamId, type: 'schedule', level: 'error',
        message: `Reclaimed stuck schedule #${scheduleId} — no fresh scan results`,
        metadata: { scheduleId, runStartedAt, since },
      });
      return;
    }

    await logEvent({
      teamId, type: 'schedule', level: 'warn',
      message: `Recovering stuck schedule #${scheduleId} via inline notify`,
      metadata: { scheduleId, runStartedAt },
    });

    await runNotifyPipeline(
      { [teamId]: siteIds },
      {
        notifySlack: cfg.notifySlack,
        notifyEmail: cfg.notifyEmail,
        notifyAI: cfg.notifyAI,
        scheduleId,
      }
    );
  } catch (err) {
    await failSchedule(supabase, schedule, `Recovery failed: ${err.message}`);
    await logEvent({
      teamId, type: 'schedule', level: 'error',
      message: `Recovery failed for schedule #${scheduleId}: ${err.message}`,
      metadata: { scheduleId, error: err.message },
    });
  }
}

async function failSchedule(supabase, schedule, errorMsg) {
  const cfg = schedule.config || {};
  await supabase
    .from('integrations')
    .update({
      config: { ...cfg, status: 'failed', error: errorMsg, failedAt: new Date().toISOString() },
    })
    .eq('id', schedule.id);
}

async function handleRecurrence(supabase, schedule) {
  const { frequency, scheduledAt, notifySlack, notifyEmail, notifyAI, createdBy } = schedule.config;
  if (!frequency || frequency === 'once') return;

  const current = new Date(scheduledAt);
  let next;
  switch (frequency) {
    case 'daily':   next = new Date(current); next.setDate(next.getDate() + 1); break;
    case 'weekly':  next = new Date(current); next.setDate(next.getDate() + 7); break;
    case 'monthly': next = new Date(current); next.setMonth(next.getMonth() + 1); break;
    default: return;
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
        scheduledAt: next.toISOString(), frequency,
        notifySlack: !!notifySlack, notifyEmail: !!notifyEmail, notifyAI: !!notifyAI,
        status: 'pending', createdBy,
      },
      enabled: true,
    })
    .select()
    .single();
  if (error) return;

  await logEvent({
    teamId: schedule.team_id, type: 'schedule', level: 'info',
    message: `Next occurrence #${newSchedule.id} scheduled for ${next.toISOString()}`,
    metadata: { newScheduleId: newSchedule.id, frequency },
  });
}
