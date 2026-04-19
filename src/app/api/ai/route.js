import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteResults } from '@/lib/db';
import { resolveAIConfig, callAIProvider, buildFullPrompt } from '@/lib/ai';
import { logEvent } from '@/lib/logs';

// POST /api/ai
// Body: { siteId }
// Returns AI-generated recommendations based on latest scan results.
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

    const prompt = buildFullPrompt(site, mobile, desktop);
    const startedAt = Date.now();

    let text;
    try {
      text = await callAIProvider(provider, apiKey, prompt, 2500);
    } catch (err) {
      await logEvent({
        teamId: site.team_id,
        type: 'ai',
        level: 'error',
        message: `AI analysis failed for ${site.name}: ${err.message}`,
        metadata: { siteId: site.id, provider, durationMs: Date.now() - startedAt },
      });
      return NextResponse.json(
        { error: 'AI analysis failed', details: err.message },
        { status: 502 }
      );
    }

    await logEvent({
      teamId: site.team_id,
      type: 'ai',
      level: 'info',
      message: `AI analysis generated for ${site.name}`,
      metadata: { siteId: site.id, provider, durationMs: Date.now() - startedAt, chars: text.length },
    });

    return NextResponse.json({ recommendations: text || 'No recommendations generated.' });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'AI analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
