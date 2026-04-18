import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { enqueueBatchScans, enqueueNotify } from '@/lib/queue';

// POST /api/schedules/run
// Execute a scheduled scan immediately or process all due schedules
// Body: { scheduleId } — run a specific schedule
// Or no body — run all pending schedules where scheduledAt <= now
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scheduleId } = body;
    const supabase = createServiceSupabase();

    let schedules;

    if (scheduleId) {
      // Run a specific schedule
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
      // Run all pending schedules that are due
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'schedule')
        .eq('enabled', true);

      if (error) throw error;

      // Filter: pending and scheduledAt <= now
      schedules = (data || []).filter((s) => {
        const config = s.config || {};
        return config.status === 'pending' && config.scheduledAt && new Date(config.scheduledAt) <= new Date(now);
      });
    }

    if (schedules.length === 0) {
      return NextResponse.json({ message: 'No schedules to run', count: 0 });
    }

    const baseUrl = getBaseUrl(request);
    const results = [];

    for (const schedule of schedules) {
      try {
        // Mark as running
        await supabase
          .from('integrations')
          .update({ config: { ...schedule.config, status: 'running' } })
          .eq('id', schedule.id);

        // Get all enabled sites for this team
        const { data: sites, error: sitesError } = await supabase
          .from('sites')
          .select('id, url, name, team_id')
          .eq('team_id', schedule.team_id)
          .eq('enabled', true);

        if (sitesError) throw sitesError;

        if (!sites || sites.length === 0) {
          // No sites to scan — mark completed
          await supabase
            .from('integrations')
            .update({ config: { ...schedule.config, status: 'completed', completedAt: new Date().toISOString() } })
            .eq('id', schedule.id);

          results.push({ scheduleId: schedule.id, status: 'completed', sites: 0 });
          continue;
        }

        // Enqueue scan jobs
        const siteIds = sites.map((s) => s.id);
        await enqueueBatchScans(siteIds, baseUrl);

        // Build teamSiteMap for notify
        const teamSiteMap = { [schedule.team_id]: siteIds };

        // Enqueue notify with schedule notification preferences
        await enqueueNotify(teamSiteMap, baseUrl, {
          notifySlack: schedule.config.notifySlack,
          notifyEmail: schedule.config.notifyEmail,
          scheduleId: schedule.id,
        });

        // Mark as running (status will be updated to completed by notify)
        await supabase
          .from('integrations')
          .update({ config: { ...schedule.config, status: 'running' } })
          .eq('id', schedule.id);

        results.push({ scheduleId: schedule.id, status: 'running', sites: sites.length });

        // Handle recurring schedules: create the next occurrence
        await handleRecurrence(supabase, schedule);
      } catch (err) {
        console.error(`Failed to run schedule ${schedule.id}:`, err);

        // Mark as failed
        await supabase
          .from('integrations')
          .update({ config: { ...schedule.config, status: 'failed', error: err.message } })
          .eq('id', schedule.id);

        results.push({ scheduleId: schedule.id, status: 'failed', error: err.message });
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

  // Don't create if next occurrence is unreasonably far in the future (> 1 year)
  const oneYear = new Date();
  oneYear.setFullYear(oneYear.getFullYear() + 1);
  if (next > oneYear) return;

  const { error } = await supabase
    .from('integrations')
    .insert({
      team_id: schedule.team_id,
      type: 'schedule',
      config: {
        scheduledAt: next.toISOString(),
        frequency,
        notifySlack,
        notifyEmail,
        status: 'pending',
        createdBy,
      },
      enabled: true,
    });

  if (error) {
    console.error('Failed to create next recurrence:', error);
  }
}

function getBaseUrl(request) {
  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
