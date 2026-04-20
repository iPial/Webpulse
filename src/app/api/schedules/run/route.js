import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { enqueueBatchScans, enqueueNotify } from '@/lib/queue';
import { runNotifyPipeline } from '@/lib/notify';
import { logEvent } from '@/lib/logs';

// POST /api/schedules/run
// Body: { scheduleId } OR empty (poll: fire due + recover stuck).
//
// Architecture (QStash-powered, each site gets its own 60s budget):
//   1. This endpoint dispatches: enqueue N scan-worker messages + 1 delayed
//      notify message via QStash, mark schedule 'running', return in < 2s.
//   2. /api/scan/worker (one Vercel function per site): mobile + desktop
//      PSI, save scan_results.
//   3. /api/scan/notify (one Vercel function, delayed): reads fresh results,
//      runs AI if requested, sends Slack/email, marks schedule 'completed'.
//
// Recovery fallback: if a schedule has been 'running' for > 3 minutes (notify
// never fired or failed), the poller's stuck handler runs runNotifyPipeline
// inline so the schedule completes even when QStash delivery misbehaves.
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
      // Recover schedules stuck in 'running' for > 3 min — notify never
      // fired (QStash delivery failed or function died). Try to rescue by
      // running notify inline if scan_results exist.
      const recoverCutoffMs = now.getTime() - 3 * 60 * 1000;
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

    // Process one schedule per invocation; leftovers picked up on next poll.
    const pickOne = scheduleId ? schedules : schedules.slice(0, 1);
    const leftover = schedules.length - pickOne.length;

    const results = [];
    for (const schedule of pickOne) {
      const outcome = await dispatchSchedule(supabase, schedule, request);
      results.push(outcome);

      if (outcome.status === 'dispatched') {
        await handleRecurrence(supabase, schedule).catch((err) => {
          console.error('Failed to create next recurrence:', err);
        });
      }
    }

    return NextResponse.json({
      message: `Dispatched ${results.length} schedule(s)`,
      results,
      deferred: leftover,
    });
  } catch (error) {
    console.error('Schedule dispatch error:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch schedules', details: error.message },
      { status: 500 }
    );
  }
}

// Enqueue N scan workers + 1 delayed notify. Returns in < 2s.
async function dispatchSchedule(supabase, schedule, request) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};

  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, url, name, team_id, tags, logo_url')
    .eq('team_id', teamId)
    .eq('enabled', true);

  if (sitesError) {
    await failSchedule(supabase, schedule, sitesError.message);
    return { scheduleId, status: 'failed', error: sitesError.message };
  }

  if (!sites || sites.length === 0) {
    await supabase
      .from('integrations')
      .update({
        config: { ...cfg, status: 'completed', completedAt: new Date().toISOString(), note: 'No sites to scan' },
      })
      .eq('id', scheduleId);
    await logEvent({
      teamId, type: 'schedule', level: 'warn',
      message: `Schedule #${scheduleId} has no enabled sites`,
      metadata: { scheduleId },
    });
    return { scheduleId, status: 'completed', sitesScanned: 0 };
  }

  const siteIds = sites.map((s) => s.id);
  const baseUrl = getPublicBaseUrl(request);
  if (!baseUrl) {
    await failSchedule(supabase, schedule, 'Public base URL not set (NEXT_PUBLIC_SITE_URL).');
    return { scheduleId, status: 'failed', error: 'Missing NEXT_PUBLIC_SITE_URL' };
  }

  // Mark running
  await supabase
    .from('integrations')
    .update({
      config: {
        ...cfg,
        status: 'running',
        runStartedAt: new Date().toISOString(),
        pendingSiteIds: siteIds,
      },
    })
    .eq('id', scheduleId);

  await logEvent({
    teamId, type: 'schedule', level: 'info',
    message: `Schedule #${scheduleId} dispatching — ${sites.length} worker(s) + delayed notify`,
    metadata: {
      scheduleId,
      sites: sites.length,
      baseUrl,
      notifySlack: !!cfg.notifySlack,
      notifyEmail: !!cfg.notifyEmail,
      notifyAI: !!cfg.notifyAI,
    },
  });

  try {
    // Each site → own QStash job → own 60s Vercel function
    await enqueueBatchScans(siteIds, baseUrl);

    // Delayed notify job aggregates results + sends
    await enqueueNotify({ [teamId]: siteIds }, baseUrl, {
      notifySlack: cfg.notifySlack,
      notifyEmail: cfg.notifyEmail,
      notifyAI: cfg.notifyAI,
      scheduleId,
    });

    await logEvent({
      teamId, type: 'schedule', level: 'info',
      message: `Schedule #${scheduleId} workers + notify enqueued via QStash`,
      metadata: { scheduleId, workerCount: siteIds.length },
    });

    return { scheduleId, status: 'dispatched', workers: siteIds.length };
  } catch (err) {
    await failSchedule(supabase, schedule, `QStash dispatch failed: ${err.message}`);
    await logEvent({
      teamId, type: 'schedule', level: 'error',
      message: `Schedule #${scheduleId} QStash dispatch failed: ${err.message}`,
      metadata: { scheduleId, error: err.message, hint: 'Check QSTASH_TOKEN / QSTASH_URL env vars.' },
    });
    return { scheduleId, status: 'failed', error: err.message };
  }
}

// Fallback: poller invokes this for schedules stuck > 3 min. Runs notify
// pipeline inline using whatever scan_results are in DB so the schedule
// doesn't stay running forever when QStash notify delivery fails.
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
      await failSchedule(
        supabase,
        schedule,
        'No scan results produced within 3 min. QStash workers may not have run — check Logs for sig-verify errors.'
      );
      await logEvent({
        teamId, type: 'schedule', level: 'error',
        message: `Reclaimed stuck schedule #${scheduleId} — no fresh scan results after 3 min`,
        metadata: { scheduleId, runStartedAt, since, hint: 'Look for "QStash sig verify failed" entries around this time.' },
      });
      return;
    }

    await logEvent({
      teamId, type: 'schedule', level: 'warn',
      message: `Recovering stuck schedule #${scheduleId} — running notify inline (QStash notify didn't fire)`,
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

function getPublicBaseUrl(request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const host = request?.headers?.get?.('host');
  if (host) return `${host.includes('localhost') ? 'http' : 'https'}://${host}`;
  return null;
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

  try {
    const { enqueueScheduleFire } = await import('@/lib/queue');
    const baseUrl = getPublicBaseUrl();
    if (baseUrl && newSchedule) {
      await enqueueScheduleFire(newSchedule.id, next, baseUrl);
    }
  } catch (err) {
    await logEvent({
      teamId: schedule.team_id, type: 'schedule', level: 'error',
      message: `QStash auto-fire failed for recurring schedule #${newSchedule.id}: ${err.message}`,
      metadata: { scheduleId: newSchedule.id, error: err.message },
    });
  }
}
