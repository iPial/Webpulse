import { NextResponse } from 'next/server';
import { getEnabledSites } from '@/lib/db';
import { enqueueBatchScans, enqueueNotify } from '@/lib/queue';
import { createServiceSupabase } from '@/lib/supabase';

// POST /api/scan/trigger
// Called by Vercel Cron (daily 6AM UTC) or manually
// Fans out scan jobs to QStash — one per site
// Also checks for pending user-created schedules
export async function POST(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Determine which frequencies to scan today
    const frequencies = getFrequenciesToScan();

    // Fetch all enabled sites for the applicable frequencies
    const allSites = [];
    for (const freq of frequencies) {
      const sites = await getEnabledSites(freq);
      allSites.push(...sites);
    }

    // Get the base URL for worker callbacks
    const baseUrl = getBaseUrl(request);

    let cronScanCount = 0;

    if (allSites.length > 0) {
      // Enqueue all scan jobs via QStash batch
      const siteIds = allSites.map((s) => s.id);
      await enqueueBatchScans(siteIds, baseUrl);

      // Build team → siteIds map for the notify job
      const teamSiteMap = {};
      for (const site of allSites) {
        if (!teamSiteMap[site.team_id]) {
          teamSiteMap[site.team_id] = [];
        }
        teamSiteMap[site.team_id].push(site.id);
      }

      // Enqueue the notify job (runs after scans complete)
      await enqueueNotify(teamSiteMap, baseUrl);
      cronScanCount = allSites.length;
    }

    // Also process any pending user-created schedules that are due
    const scheduledCount = await processPendingSchedules(baseUrl);

    return NextResponse.json({
      message: 'Scan jobs enqueued',
      count: cronScanCount,
      scheduledScansTriggered: scheduledCount,
      frequencies,
    });
  } catch (error) {
    console.error('Scan trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scans', details: error.message },
      { status: 500 }
    );
  }
}

// Check for pending schedules where scheduledAt <= now and trigger them
async function processPendingSchedules(baseUrl) {
  const supabase = createServiceSupabase();

  const { data: schedules, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('type', 'schedule')
    .eq('enabled', true);

  if (error) {
    console.error('Failed to fetch pending schedules:', error);
    return 0;
  }

  const now = new Date();
  const pending = (schedules || []).filter((s) => {
    const config = s.config || {};
    return config.status === 'pending' && config.scheduledAt && new Date(config.scheduledAt) <= now;
  });

  if (pending.length === 0) return 0;

  let triggered = 0;

  for (const schedule of pending) {
    try {
      // Mark as running
      await supabase
        .from('integrations')
        .update({ config: { ...schedule.config, status: 'running' } })
        .eq('id', schedule.id);

      // Get enabled sites for this team
      const { data: sites } = await supabase
        .from('sites')
        .select('id, url, name, team_id')
        .eq('team_id', schedule.team_id)
        .eq('enabled', true);

      if (!sites || sites.length === 0) {
        await supabase
          .from('integrations')
          .update({ config: { ...schedule.config, status: 'completed', completedAt: now.toISOString() } })
          .eq('id', schedule.id);
        continue;
      }

      const siteIds = sites.map((s) => s.id);
      await enqueueBatchScans(siteIds, baseUrl);

      const teamSiteMap = { [schedule.team_id]: siteIds };
      await enqueueNotify(teamSiteMap, baseUrl, {
        notifySlack: schedule.config.notifySlack,
        notifyEmail: schedule.config.notifyEmail,
        scheduleId: schedule.id,
      });

      triggered++;
    } catch (err) {
      console.error(`Failed to process schedule ${schedule.id}:`, err);
      await supabase
        .from('integrations')
        .update({ config: { ...schedule.config, status: 'failed', error: err.message } })
        .eq('id', schedule.id);
    }
  }

  return triggered;
}

// Determine which scan frequencies should run today
function getFrequenciesToScan() {
  const now = new Date();
  const frequencies = ['daily'];

  // Weekly: scan on Mondays
  if (now.getUTCDay() === 1) {
    frequencies.push('weekly');
  }

  // Monthly: scan on the 1st of the month
  if (now.getUTCDate() === 1) {
    frequencies.push('monthly');
  }

  return frequencies;
}

function getBaseUrl(request) {
  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
