import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { enqueueBatchScans, enqueueNotify } from '@/lib/queue';
import { logEvent } from '@/lib/logs';

// POST /api/schedules/run
// Body: { scheduleId } to run a specific schedule, or no body to pick due ones.
//
// Architecture:
//  - Each schedule "run" enqueues one QStash scan worker PER SITE and a
//    delayed notify job. This endpoint returns in < 5s so it can never
//    time out. The actual scan work happens in /api/scan/worker (each
//    site gets its own 60s function budget). Slack/email + AI happen in
//    /api/scan/notify after all scans are expected to be done.
//  - Also reclaims schedules stuck in 'running' for > 2 minutes (these
//    are left over from the old inline path before this refactor).
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
      const reclaimCutoffMs = now.getTime() - 2 * 60 * 1000;

      // Reclaim stuck-running schedules (only applies to OLD inline runs).
      // New flow returns fast so this path is rarely hit.
      const stuck = (data || []).filter((s) => {
        const cfg = s.config || {};
        if (cfg.status !== 'running') return false;
        if (!cfg.runStartedAt) return true;
        return new Date(cfg.runStartedAt).getTime() < reclaimCutoffMs;
      });

      for (const s of stuck) {
        const cfg = s.config || {};
        await supabase
          .from('integrations')
          .update({
            config: {
              ...cfg,
              status: 'failed',
              error: 'Function timed out. Click Retry to re-run.',
              staleReclaimedAt: now.toISOString(),
            },
          })
          .eq('id', s.id);
        await logEvent({
          teamId: s.team_id,
          type: 'schedule',
          level: 'error',
          message: `Reclaimed stuck schedule #${s.id} (running since ${cfg.runStartedAt || 'unknown'})`,
          metadata: { scheduleId: s.id, runStartedAt: cfg.runStartedAt },
        });
      }

      schedules = (data || []).filter((s) => {
        const cfg = s.config || {};
        return cfg.status === 'pending' && cfg.scheduledAt && new Date(cfg.scheduledAt) <= now;
      });
    }

    if (schedules.length === 0) {
      return NextResponse.json({ message: 'No schedules to run', count: 0 });
    }

    // Process one schedule per invocation so the function returns quickly.
    // For scheduleId-specific calls, we still only process that one.
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

// Dispatch a schedule: mark running, enqueue scan workers + notify, return.
// NO scan work happens here — all scans run in /api/scan/worker invocations.
async function dispatchSchedule(supabase, schedule, request) {
  const scheduleId = schedule.id;
  const teamId = schedule.team_id;
  const cfg = schedule.config || {};

  // Load sites first so we can mark 'no sites' without going through QStash
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, url, name, team_id, tags')
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
    await failSchedule(supabase, schedule, 'Public base URL not configured (set NEXT_PUBLIC_SITE_URL).');
    return { scheduleId, status: 'failed', error: 'Missing NEXT_PUBLIC_SITE_URL' };
  }

  // Mark running BEFORE enqueueing so the UI shows progress immediately.
  await supabase
    .from('integrations')
    .update({
      config: { ...cfg, status: 'running', runStartedAt: new Date().toISOString() },
    })
    .eq('id', scheduleId);

  await logEvent({
    teamId, type: 'schedule', level: 'info',
    message: `Schedule #${scheduleId} dispatching — ${sites.length} site(s) queued`,
    metadata: {
      scheduleId,
      sites: sites.length,
      notifySlack: !!cfg.notifySlack,
      notifyEmail: !!cfg.notifyEmail,
      notifyAI: !!cfg.notifyAI,
    },
  });

  try {
    // Enqueue one scan worker per site (parallel, each has its own 60s budget)
    await enqueueBatchScans(siteIds, baseUrl);

    // Enqueue the notify job with a delay — it polls the DB for the latest
    // results. The existing enqueueNotify helper scales delay by site count
    // (min 60s, +5s per site beyond 10, max 300s).
    await enqueueNotify({ [teamId]: siteIds }, baseUrl, {
      notifySlack: cfg.notifySlack,
      notifyEmail: cfg.notifyEmail,
      notifyAI: cfg.notifyAI,
      scheduleId,
    });

    await logEvent({
      teamId, type: 'schedule', level: 'info',
      message: `Schedule #${scheduleId} workers enqueued + notify scheduled`,
      metadata: { scheduleId, workerCount: siteIds.length },
    });

    return { scheduleId, status: 'dispatched', workers: siteIds.length };
  } catch (err) {
    await failSchedule(supabase, schedule, `Queue dispatch failed: ${err.message}`);
    await logEvent({
      teamId, type: 'schedule', level: 'error',
      message: `Schedule #${scheduleId} queue dispatch failed: ${err.message}`,
      metadata: { scheduleId, error: err.message },
    });
    return { scheduleId, status: 'failed', error: err.message };
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
    type: 'schedule', level: 'info',
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
      teamId: schedule.team_id,
      type: 'schedule', level: 'error',
      message: `QStash auto-fire failed for recurring schedule #${newSchedule.id}: ${err.message}`,
      metadata: { scheduleId: newSchedule.id, error: err.message },
    });
  }
}
