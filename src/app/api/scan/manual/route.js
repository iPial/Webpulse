import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getUserRole, saveScanResult, upsertMonthlySnapshot } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { runFullAudit, formatAuditSummary } from '@/lib/pagespeed';

// POST /api/scan/manual
// Body: { siteId }
// Runs a scan inline (no queue) — for manual "Scan Now" from the UI
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const { siteId } = body;

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    const site = await getSiteById(cookieStore, parseInt(siteId, 10));
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check permissions
    const role = await getUserRole(cookieStore, site.team_id);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get team's API key
    const supabase = createServiceSupabase();
    const { data: psiConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', site.team_id)
      .eq('type', 'pagespeed')
      .eq('enabled', true)
      .maybeSingle();

    const apiKey = psiConfig?.config?.apiKey || process.env.GOOGLE_PSI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No PageSpeed API key configured. Add one in Settings > Integrations.' },
        { status: 400 }
      );
    }

    // Run scan
    const { mobile, desktop } = await runFullAudit(site.url, { apiKey });

    // Save results
    await Promise.all([
      saveScanResult({
        siteId: site.id,
        strategy: 'mobile',
        scores: mobile.scores,
        vitals: mobile.vitals,
        audits: mobile.audits,
      }),
      saveScanResult({
        siteId: site.id,
        strategy: 'desktop',
        scores: desktop.scores,
        vitals: desktop.vitals,
        audits: desktop.audits,
      }),
    ]);

    // Upsert monthly snapshot
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const summary = formatAuditSummary(mobile.audits);

    await upsertMonthlySnapshot({
      siteId: site.id,
      month,
      scores: mobile.scores,
      counts: {
        critical: summary.criticalCount,
        improvement: summary.improvementCount,
        optional: summary.optionalCount,
      },
      avgVitals: {
        fcpMs: mobile.vitals.fcpMs != null ? Math.round(mobile.vitals.fcpMs) : null,
        lcpMs: mobile.vitals.lcpMs != null ? Math.round(mobile.vitals.lcpMs) : null,
      },
    });

    return NextResponse.json({
      success: true,
      mobile: mobile.scores,
      desktop: desktop.scores,
    });
  } catch (error) {
    console.error('Manual scan error:', error);
    return NextResponse.json(
      { error: 'Scan failed', details: error.message },
      { status: 500 }
    );
  }
}
