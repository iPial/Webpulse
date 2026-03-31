import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getUserRole, saveScanResult, upsertMonthlySnapshot } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';
import { runPageSpeedAudit, formatAuditSummary } from '@/lib/pagespeed';

// POST /api/scan/manual
// Body: { siteId, strategy: 'mobile' | 'desktop' }
// Scans ONE strategy at a time — client calls twice for full scan
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const { siteId, strategy = 'mobile' } = body;

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    if (!['mobile', 'desktop'].includes(strategy)) {
      return NextResponse.json({ error: 'strategy must be mobile or desktop' }, { status: 400 });
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

    // Run single strategy scan
    const result = await runPageSpeedAudit(site.url, strategy, { apiKey });

    // Save result
    await saveScanResult({
      siteId: site.id,
      strategy,
      scores: result.scores,
      vitals: result.vitals,
      audits: result.audits,
    });

    // Upsert monthly snapshot (only for mobile — primary metric)
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

    return NextResponse.json({
      success: true,
      strategy,
      scores: result.scores,
    });
  } catch (error) {
    console.error('Manual scan error:', error);
    return NextResponse.json(
      { error: 'Scan failed', details: error.message },
      { status: 500 }
    );
  }
}
