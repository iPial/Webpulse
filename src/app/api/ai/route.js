import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSiteById, getSiteResults } from '@/lib/db';
import { createServiceSupabase } from '@/lib/supabase';

// POST /api/ai
// Body: { siteId }
// Returns AI-generated recommendations based on latest scan results
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

    // Get team's AI provider config, fall back to legacy anthropic type, then env var
    const supabase = createServiceSupabase();
    let { data: aiConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', site.team_id)
      .eq('type', 'ai_provider')
      .eq('enabled', true)
      .maybeSingle();

    // Backwards compat: fall back to legacy 'anthropic' type
    if (!aiConfig) {
      const { data: legacyConfig } = await supabase
        .from('integrations')
        .select('config')
        .eq('team_id', site.team_id)
        .eq('type', 'anthropic')
        .eq('enabled', true)
        .maybeSingle();
      if (legacyConfig) {
        aiConfig = { config: { provider: 'anthropic', apiKey: legacyConfig.config.apiKey } };
      }
    }

    const provider = aiConfig?.config?.provider || 'anthropic';
    const apiKey = aiConfig?.config?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI not configured. Add your AI API key in Settings > Integrations.' },
        { status: 503 }
      );
    }

    // Get latest results (mobile + desktop)
    const results = await getSiteResults(cookieStore, site.id, { limit: 4 });
    const mobile = results.find((r) => r.strategy === 'mobile');
    const desktop = results.find((r) => r.strategy === 'desktop');

    if (!mobile && !desktop) {
      return NextResponse.json({ error: 'No scan results available for analysis' }, { status: 404 });
    }

    const prompt = buildPrompt(site, mobile, desktop);

    let text;
    if (provider === 'openai') {
      text = await callOpenAI(apiKey, prompt);
    } else if (provider === 'gemini') {
      text = await callGemini(apiKey, prompt);
    } else {
      text = await callAnthropic(apiKey, prompt);
    }

    return NextResponse.json({ recommendations: text });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'AI analysis failed', details: error.message },
      { status: 500 }
    );
  }
}

async function callAnthropic(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Anthropic API error:', errBody);
    throw new Error('AI analysis failed');
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'No recommendations generated.';
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('OpenAI API error:', errBody);
    throw new Error('AI analysis failed');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No recommendations generated.';
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Gemini API error:', errBody);
    throw new Error('AI analysis failed');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No recommendations generated.';
}

function buildPrompt(site, mobile, desktop) {
  const parts = [
    `Analyze the PageSpeed Insights results for "${site.name}" (${site.url}) and provide actionable recommendations.`,
    '',
  ];

  if (mobile) {
    parts.push('## Mobile Results');
    parts.push(`Performance: ${mobile.performance}/100`);
    parts.push(`Accessibility: ${mobile.accessibility}/100`);
    parts.push(`Best Practices: ${mobile.best_practices}/100`);
    parts.push(`SEO: ${mobile.seo}/100`);
    parts.push(`FCP: ${mobile.fcp || 'N/A'} | LCP: ${mobile.lcp || 'N/A'} | TBT: ${mobile.tbt || 'N/A'} | CLS: ${mobile.cls || 'N/A'}`);

    if (mobile.audits) {
      const criticals = mobile.audits.critical || [];
      const improvements = mobile.audits.improvement || [];

      if (criticals.length > 0) {
        parts.push('');
        parts.push('### Critical Issues (Mobile)');
        for (const a of criticals.slice(0, 10)) {
          parts.push(`- ${a.title} (score: ${a.score})${a.displayValue ? ` — ${a.displayValue}` : ''}`);
        }
      }

      if (improvements.length > 0) {
        parts.push('');
        parts.push('### Improvement Opportunities (Mobile)');
        for (const a of improvements.slice(0, 10)) {
          parts.push(`- ${a.title} (score: ${a.score})${a.displayValue ? ` — ${a.displayValue}` : ''}`);
        }
      }
    }
  }

  if (desktop) {
    parts.push('');
    parts.push('## Desktop Results');
    parts.push(`Performance: ${desktop.performance}/100`);
    parts.push(`Accessibility: ${desktop.accessibility}/100`);
    parts.push(`Best Practices: ${desktop.best_practices}/100`);
    parts.push(`SEO: ${desktop.seo}/100`);
  }

  parts.push('');
  parts.push('Provide a prioritized list of 5-7 specific, actionable recommendations. For each recommendation:');
  parts.push('1. State the issue clearly');
  parts.push('2. Explain the expected impact on scores');
  parts.push('3. Provide concrete steps to fix it');
  parts.push('');
  parts.push('Focus on the highest-impact fixes first. Be specific to this site, not generic advice.');

  return parts.join('\n');
}
