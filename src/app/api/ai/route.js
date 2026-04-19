import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteResults, saveSiteAIAnalysis, upsertSiteFixes } from '@/lib/db';
import {
  resolveAIConfig,
  callAIProvider,
  buildCompactPrompt,
  parseCompactResponse,
  renderCompactAsMarkdown,
} from '@/lib/ai';
import { logEvent } from '@/lib/logs';

// POST /api/ai
// Body: { siteId }
// Single source of truth: one AI call returns structured fixes; we render the
// markdown view AND populate the checklist from the SAME data. This guarantees
// the counts match.
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

    const { provider, apiKey } = await resolveAIConfig(site.team_id);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI not configured. Add your AI API key in Settings > Integrations.' },
        { status: 503 }
      );
    }

    const results = await getSiteResults(cookieStore, site.id, { limit: 4 });
    const mobile = results.find((r) => r.strategy === 'mobile');
    const desktop = results.find((r) => r.strategy === 'desktop');

    if (!mobile && !desktop) {
      return NextResponse.json({ error: 'No scan results available for analysis' }, { status: 404 });
    }

    // We scan mobile (primary metric); desktop scores are shown elsewhere.
    // Compact prompt covers all critical + improvement issues.
    const analysisSource = mobile || desktop;
    const compactPrompt = buildCompactPrompt(site, analysisSource);
    const startedAt = Date.now();

    let text;
    try {
      text = await callAIProvider(provider, apiKey, compactPrompt, 4000);
    } catch (err) {
      await logEvent({
        teamId: site.team_id,
        type: 'ai',
        level: 'error',
        message: `AI analysis failed for ${site.name}: ${err.message}`,
        metadata: { siteId: site.id, provider, durationMs: Date.now() - startedAt },
      });
      return NextResponse.json({ error: 'AI analysis failed', details: err.message }, { status: 502 });
    }

    const parsed = parseCompactResponse(text);
    if (!parsed?.topFixes?.length) {
      await logEvent({
        teamId: site.team_id,
        type: 'ai',
        level: 'warn',
        message: `AI returned no parseable fixes for ${site.name}`,
        metadata: { siteId: site.id, provider, preview: text?.slice(0, 200) },
      });
      return NextResponse.json(
        { error: 'AI did not return a usable analysis. Try again.' },
        { status: 502 }
      );
    }

    const isWPRocket = Array.isArray(site.tags) && site.tags.includes('wp-rocket');
    const markdown = renderCompactAsMarkdown(parsed, { isWPRocket });

    // Save markdown + upsert fixes from the SAME parsed data
    await Promise.all([
      saveSiteAIAnalysis(site.id, markdown),
      upsertSiteFixes(site.id, parsed.topFixes).catch((err) => {
        console.error('upsertSiteFixes failed in /api/ai:', err.message);
      }),
    ]);

    await logEvent({
      teamId: site.team_id,
      type: 'ai',
      level: 'info',
      message: `AI analysis generated for ${site.name} (${parsed.topFixes.length} fixes)`,
      metadata: {
        siteId: site.id,
        provider,
        durationMs: Date.now() - startedAt,
        fixCount: parsed.topFixes.length,
      },
    });

    return NextResponse.json({
      recommendations: markdown,
      generatedAt: new Date().toISOString(),
      fixCount: parsed.topFixes.length,
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'AI analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
