import { NextResponse } from 'next/server';
import { getEnabledSites } from '@/lib/db';
import { enqueueBatchScans, enqueueNotify } from '@/lib/queue';

// POST /api/scan/trigger
// Called by Vercel Cron (daily 6AM UTC) or manually
// Fans out scan jobs to QStash — one per site
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

    if (allSites.length === 0) {
      return NextResponse.json({ message: 'No sites to scan', count: 0 });
    }

    // Get the base URL for worker callbacks
    const baseUrl = getBaseUrl(request);

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

    return NextResponse.json({
      message: 'Scan jobs enqueued',
      count: allSites.length,
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
