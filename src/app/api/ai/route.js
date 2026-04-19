import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteResults, saveSiteAIAnalysis, upsertSiteFixes } from '@/lib/db';
import {
  resolveAIConfig,
  callAIProvider,
  buildFullPrompt,
  buildCompactPrompt,
  parseCompactResponse,
} from '@/lib/ai';
import { logEvent } from '@/lib/logs';

// POST /api/ai
// Body: { siteId }
// Returns AI-generated recommendations AND populates the fix checklist.
// Both runs happen in parallel so the extra call adds no latency in practice.
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

    const fullPrompt = buildFullPrompt(site, mobile, desktop);
    const compactPrompt = mobile ? buildCompactPrompt(site, mobile) : null;
    const startedAt = Date.now();

    // Run full markdown + compact JSON in parallel
    const [fullOutcome, compactOutcome] = await Promise.allSettled([
      callAIProvider(provider, apiKey, fullPrompt, 2500),
      compactPrompt
        ? callAIProvider(provider, apiKey, compactPrompt, 3500)
        : Promise.resolve(null),
    ]);

    // The main (full markdown) result must succeed — return 502 if it failed
    if (fullOutcome.status !== 'fulfilled') {
      const errMsg = fullOutcome.reason?.message || 'Unknown error';
      await logEvent({
        teamId: site.team_id,
        type: 'ai',
        level: 'error',
        message: `AI analysis failed for ${site.name}: ${errMsg}`,
        metadata: { siteId: site.id, provider, durationMs: Date.now() - startedAt },
      });
      return NextResponse.json({ error: 'AI analysis failed', details: errMsg }, { status: 502 });
    }

    const markdown = fullOutcome.value || 'No recommendations generated.';

    // Persist the markdown so the page survives reloads
    await saveSiteAIAnalysis(site.id, markdown);

    // If the compact call succeeded, upsert its top fixes into the checklist
    let fixCount = 0;
    if (compactOutcome.status === 'fulfilled' && compactOutcome.value) {
      const parsed = parseCompactResponse(compactOutcome.value);
      if (parsed?.topFixes?.length) {
        try {
          await upsertSiteFixes(site.id, parsed.topFixes);
          fixCount = parsed.topFixes.length;
        } catch (err) {
          console.error('upsertSiteFixes failed in /api/ai:', err.message);
        }
      }
    }

    await logEvent({
      teamId: site.team_id,
      type: 'ai',
      level: 'info',
      message: `AI analysis generated for ${site.name}${fixCount ? ` (+${fixCount} fix tasks)` : ''}`,
      metadata: {
        siteId: site.id,
        provider,
        durationMs: Date.now() - startedAt,
        chars: markdown.length,
        fixCount,
        compactOk: compactOutcome.status === 'fulfilled',
      },
    });

    return NextResponse.json({
      recommendations: markdown,
      generatedAt: new Date().toISOString(),
      fixCount,
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'AI analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
