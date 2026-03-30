import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/queue';
import { saveScanResult, upsertMonthlySnapshot, getPreviousSnapshot } from '@/lib/db';
import { runFullAudit, detectRegression, formatAuditSummary } from '@/lib/pagespeed';
import { createServiceSupabase } from '@/lib/supabase';

// POST /api/scan/worker
// Called by QStash — scans a single site (mobile + desktop)
export async function POST(request) {
  let body;

  try {
    body = await verifyQStashSignature(request);
  } catch (error) {
    console.error('QStash verification failed:', error.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = body;
  if (!siteId) {
    return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
  }

  try {
    // Fetch site details using service role (worker has no user session)
    const supabase = createServiceSupabase();
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, url, name, team_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get team's PageSpeed API key from integrations (fall back to env var)
    const { data: psiConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', site.team_id)
      .eq('type', 'pagespeed')
      .eq('enabled', true)
      .maybeSingle();

    const apiKey = psiConfig?.config?.apiKey || process.env.GOOGLE_PSI_API_KEY;

    // Run PageSpeed audits (mobile + desktop in parallel)
    const { mobile, desktop } = await runFullAudit(site.url, { apiKey });

    // Save both results to DB
    const [mobileResult, desktopResult] = await Promise.all([
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

    // Upsert monthly snapshot (use mobile scores as primary)
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const mobileAuditSummary = formatAuditSummary(mobile.audits);

    await upsertMonthlySnapshot({
      siteId: site.id,
      month,
      scores: mobile.scores,
      counts: {
        critical: mobileAuditSummary.criticalCount,
        improvement: mobileAuditSummary.improvementCount,
        optional: mobileAuditSummary.optionalCount,
      },
      avgVitals: {
        fcpMs: mobile.vitals.fcpMs != null ? Math.round(mobile.vitals.fcpMs) : null,
        lcpMs: mobile.vitals.lcpMs != null ? Math.round(mobile.vitals.lcpMs) : null,
      },
    });

    // Check for regressions
    const previousSnapshot = await getPreviousSnapshot(site.id, month);
    const regressions = detectRegression(mobile.scores, previousSnapshot);

    return NextResponse.json({
      success: true,
      siteId: site.id,
      siteName: site.name,
      mobile: mobile.scores,
      desktop: desktop.scores,
      regressions,
    });
  } catch (error) {
    console.error(`Scan worker error for site ${siteId}:`, error);
    return NextResponse.json(
      { error: 'Scan failed', siteId, details: error.message },
      { status: 500 }
    );
  }
}
