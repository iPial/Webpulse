import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { enqueueScan } from '@/lib/queue';

// POST /api/webhook
// External trigger to scan a specific site or all sites for a team
// Auth: Bearer token using CRON_SECRET
//
// Body options:
//   { siteId: 123 }            — scan a single site
//   { url: "https://..." }     — scan by URL match
//   { teamId: "uuid" }         — scan all enabled sites for a team
export async function POST(request) {
  // Verify auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { siteId, url, teamId } = body;

    if (!siteId && !url && !teamId) {
      return NextResponse.json(
        { error: 'Provide siteId, url, or teamId' },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();
    const baseUrl = getBaseUrl(request);
    const enqueued = [];

    if (siteId) {
      // Scan a specific site by ID
      const { data: site, error } = await supabase
        .from('sites')
        .select('id, url, name')
        .eq('id', siteId)
        .eq('enabled', true)
        .maybeSingle();

      if (error) throw error;
      if (!site) {
        return NextResponse.json({ error: 'Site not found or disabled' }, { status: 404 });
      }

      await enqueueScan(site.id, baseUrl);
      enqueued.push({ id: site.id, name: site.name });

    } else if (url) {
      // Find site by URL
      const { data: site, error } = await supabase
        .from('sites')
        .select('id, url, name')
        .eq('url', url)
        .eq('enabled', true)
        .maybeSingle();

      if (error) throw error;
      if (!site) {
        return NextResponse.json({ error: 'No enabled site matches that URL' }, { status: 404 });
      }

      await enqueueScan(site.id, baseUrl);
      enqueued.push({ id: site.id, name: site.name });

    } else if (teamId) {
      // Scan all enabled sites for a team
      const { data: sites, error } = await supabase
        .from('sites')
        .select('id, url, name')
        .eq('team_id', teamId)
        .eq('enabled', true);

      if (error) throw error;
      if (!sites || sites.length === 0) {
        return NextResponse.json({ error: 'No enabled sites for this team' }, { status: 404 });
      }

      for (const site of sites) {
        await enqueueScan(site.id, baseUrl);
        enqueued.push({ id: site.id, name: site.name });
      }
    }

    return NextResponse.json({
      success: true,
      scansEnqueued: enqueued.length,
      sites: enqueued,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

function getBaseUrl(request) {
  const host = request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
