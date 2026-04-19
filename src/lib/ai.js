// Shared AI helpers used by /api/ai (full analysis) and the schedule runner (compact JSON summary).

// ---------- Provider resolution ----------

import { createServiceSupabase } from './supabase';

export async function resolveAIConfig(teamId) {
  const supabase = createServiceSupabase();

  let { data: cfg } = await supabase
    .from('integrations')
    .select('config')
    .eq('team_id', teamId)
    .eq('type', 'ai_provider')
    .eq('enabled', true)
    .maybeSingle();

  if (!cfg) {
    // Backwards-compat: legacy 'anthropic' type
    const { data: legacy } = await supabase
      .from('integrations')
      .select('config')
      .eq('team_id', teamId)
      .eq('type', 'anthropic')
      .eq('enabled', true)
      .maybeSingle();
    if (legacy) cfg = { config: { provider: 'anthropic', apiKey: legacy.config.apiKey } };
  }

  const provider = cfg?.config?.provider || 'anthropic';
  const apiKey = cfg?.config?.apiKey || process.env.ANTHROPIC_API_KEY;
  return { provider, apiKey };
}

// ---------- Provider calls ----------

export async function callAnthropic(apiKey, prompt, maxTokens = 2500) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export async function callOpenAI(apiKey, prompt, maxTokens = 2500) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function callAIProvider(provider, apiKey, prompt, maxTokens = 2500) {
  if (provider === 'openai') return callOpenAI(apiKey, prompt, maxTokens);
  if (provider === 'gemini') return callGemini(apiKey, prompt);
  return callAnthropic(apiKey, prompt, maxTokens);
}

// ---------- Prompts ----------

function buildScoreBlock(label, result) {
  const lines = [`## ${label} Scores`];
  lines.push(`Performance: ${result.performance}/100`);
  lines.push(`Accessibility: ${result.accessibility}/100`);
  lines.push(`Best Practices: ${result.best_practices}/100`);
  lines.push(`SEO: ${result.seo}/100`);
  lines.push(
    `Core Vitals — LCP: ${result.lcp || 'N/A'} · FCP: ${result.fcp || 'N/A'} · TBT: ${result.tbt || 'N/A'} · CLS: ${result.cls || 'N/A'}`
  );
  return lines;
}

function buildAuditList(audits, heading, limit = 12) {
  if (!audits || audits.length === 0) return [];
  const lines = ['', `### ${heading}`];
  for (const a of audits.slice(0, limit)) {
    lines.push('');
    lines.push(`**${a.title}** (score ${a.score}${a.displayValue ? `, ${a.displayValue}` : ''})`);
    if (a.description) lines.push(a.description.trim());
  }
  return lines;
}

// Full-page structured prompt — used by the site detail "Analyze" button.
export function buildFullPrompt(site, mobile, desktop) {
  const isWPRocket = Array.isArray(site.tags) && site.tags.includes('wp-rocket');
  return isWPRocket
    ? buildWPRocketPrompt(site, mobile, desktop)
    : buildGenericPrompt(site, mobile, desktop);
}

function buildWPRocketPrompt(site, mobile, desktop) {
  const parts = [];
  parts.push(`You are a WordPress performance expert who specialises in WP Rocket caching and optimisation.`);
  parts.push(`The site "${site.name}" (${site.url}) runs WordPress with the WP Rocket plugin.`);
  parts.push('');
  parts.push(`For EACH issue below, respond in this EXACT markdown format:`);
  parts.push('');
  parts.push(`### [Issue title]`);
  parts.push(`- **Impact**: [High / Medium / Low] · Expected gain: ~+N points`);
  parts.push(`- **WP Rocket path**: \`[Tab] → [Section] → [Option]\``);
  parts.push(`- **Action**: [precise toggle / setting / value to change]`);
  parts.push(`- **Caveats**: [known conflicts, compatibility, things to verify after]`);
  parts.push('');
  parts.push(`Only reference real WP Rocket tabs: Dashboard, Cache, File Optimization, Media, Preload, Advanced Rules, Database, CDN, Heartbeat, Add-ons, Image Optimization.`);
  parts.push(`If an issue cannot be fixed with WP Rocket, say so plainly and suggest the correct tool.`);
  parts.push(`Do not invent WP Rocket features. Prioritise by expected score gain and Core Web Vitals.`);
  parts.push(`Number each issue heading in priority order — use "### 1. [Issue title]", "### 2. [Issue title]", etc.`);
  parts.push(`Cover every critical issue and the top improvement opportunities (up to 20 total). Keep each entry under 120 words.`);
  parts.push('');
  parts.push('---');
  if (mobile) {
    parts.push('', ...buildScoreBlock('Mobile', mobile));
    if (mobile.audits) {
      parts.push(...buildAuditList(mobile.audits.critical || [], 'Critical Issues (Mobile)'));
      parts.push(...buildAuditList(mobile.audits.improvement || [], 'Improvement Opportunities (Mobile)', 10));
    }
  }
  if (desktop) parts.push('', ...buildScoreBlock('Desktop', desktop));
  parts.push('');
  parts.push('Begin now. No preamble — start with the first `### [Issue title]`.');
  return parts.join('\n');
}

function buildGenericPrompt(site, mobile, desktop) {
  const parts = [`Analyze the PageSpeed Insights results for "${site.name}" (${site.url}) and provide actionable recommendations.`, ''];
  if (mobile) {
    parts.push(...buildScoreBlock('Mobile', mobile));
    if (mobile.audits) {
      parts.push(...buildAuditList(mobile.audits.critical || [], 'Critical Issues (Mobile)'));
      parts.push(...buildAuditList(mobile.audits.improvement || [], 'Improvement Opportunities (Mobile)', 10));
    }
  }
  if (desktop) parts.push('', ...buildScoreBlock('Desktop', desktop));
  parts.push('');
  parts.push('Number each issue heading in priority order — "### 1. [Issue title]", "### 2. [Issue title]", etc.');
  parts.push('For each issue provide:');
  parts.push('');
  parts.push('### N. [Issue title]');
  parts.push('- **Impact**: [High / Medium / Low] · Expected gain: ~+N points');
  parts.push('- **Action**: [specific, concrete steps to fix it]');
  parts.push('- **Caveats**: [things to watch out for]');
  parts.push('');
  parts.push('Cover every critical issue and the top improvement opportunities (up to 20 total). Start directly with the first heading — no preamble.');
  return parts.join('\n');
}

// ---------- Compact JSON prompt — for notifications (Slack/email) ----------

// Render a JSON analysis (from the compact prompt) as numbered markdown so
// the recommendations view and the fix checklist stay in lockstep.
export function renderCompactAsMarkdown(parsed, { isWPRocket = false } = {}) {
  if (!parsed?.topFixes?.length) return '';

  const lines = [];
  if (parsed.summary) {
    lines.push(`> ${parsed.summary}`);
    lines.push('');
  }

  parsed.topFixes.forEach((fix, i) => {
    const n = i + 1;
    lines.push(`### ${n}. ${fix.title}`);
    const meta = [];
    if (fix.impact) meta.push(`**Impact**: ${fix.impact}`);
    if (fix.expectedGain) meta.push(`Expected gain: ${fix.expectedGain}`);
    if (meta.length) lines.push(`- ${meta.join(' · ')}`);
    if (isWPRocket && fix.rocketPath) {
      lines.push(`- **WP Rocket path**: \`${fix.rocketPath}\``);
    }
    if (fix.action) lines.push(`- **Action**: ${fix.action}`);
    if (fix.caveats) lines.push(`- **Caveats**: ${fix.caveats}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Asks the model to return ONLY JSON with a one-line summary and one fix
// per provided issue (critical + improvement). Includes Impact / Expected gain
// / WP Rocket path / Caveats so the dashboard can render rich per-issue cards.
export function buildCompactPrompt(site, mobile) {
  const isWPRocket = Array.isArray(site.tags) && site.tags.includes('wp-rocket');

  const parts = [];
  parts.push(`Analyse this PageSpeed result and respond with ONLY valid JSON — no prose, no markdown, no code fences.`);
  parts.push('');
  parts.push(`Target JSON shape:`);
  parts.push('{');
  parts.push('  "summary": "one-sentence diagnosis, max 120 chars",');
  parts.push('  "topFixes": [');
  parts.push('    {');
  parts.push('      "title": "Short issue title (max 80 chars, stable across scans)",');
  parts.push('      "impact": "High | Medium | Low",');
  parts.push('      "expectedGain": "~+N points" or "" if unknown,');
  parts.push(isWPRocket
    ? '      "rocketPath": "Tab → Section → Option" or "" if not addressable via WP Rocket,'
    : '      "rocketPath": "" (unused — leave empty),');
  parts.push('      "action": "precise action to take (max 200 chars)",');
  parts.push('      "caveats": "known conflicts or verification step (max 200 chars)" or ""');
  parts.push('    }');
  parts.push('  ]');
  parts.push('}');
  parts.push('');
  parts.push('Rules:');
  parts.push('- Produce ONE fix per issue in the lists below (critical + improvement). Don\'t skip any.');
  parts.push('- Order by impact: High → Medium → Low.');
  parts.push('- Keep titles STABLE across scans (they are used as a database key). Prefer the Lighthouse audit title verbatim.');

  if (isWPRocket) {
    parts.push('- This site uses WP Rocket. rocketPath MUST reference a real WP Rocket setting path using "Tab → Section → Option".');
    parts.push('- Real tabs: Dashboard, Cache, File Optimization, Media, Preload, Advanced Rules, Database, CDN, Heartbeat, Add-ons, Image Optimization.');
    parts.push('- If an issue is NOT addressable via WP Rocket, leave rocketPath empty and explain in action + caveats.');
  } else {
    parts.push('- Each action should be concrete and tool-specific (CDN, plugin, theme, or server config).');
  }

  parts.push('');
  parts.push(`Site: ${site.name} (${site.url})`);
  parts.push('');

  if (mobile) {
    parts.push(...buildScoreBlock('Mobile', mobile));
    if (mobile.audits?.critical?.length) {
      parts.push(...buildAuditList(mobile.audits.critical, 'Critical Issues', 30));
    }
    if (mobile.audits?.improvement?.length) {
      parts.push(...buildAuditList(mobile.audits.improvement, 'Improvement Opportunities', 20));
    }
  }

  parts.push('');
  parts.push('Return only the JSON object — no preamble, no code fence.');

  return parts.join('\n');
}

// Parse the model's JSON output. Handles common wrappers (code fences, leading
// prose) gracefully. Returns `null` on failure.
export function parseCompactResponse(text) {
  if (!text || typeof text !== 'string') return null;

  // Strip common code-fence wrappers
  let src = text.trim();
  if (src.startsWith('```')) {
    src = src.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  // Try direct parse first
  try {
    return normalizeCompact(JSON.parse(src));
  } catch {
    // fall through
  }

  // Extract first {...} block
  const first = src.indexOf('{');
  const last = src.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;

  try {
    return normalizeCompact(JSON.parse(src.slice(first, last + 1)));
  } catch {
    return null;
  }
}

function normalizeCompact(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const topFixes = Array.isArray(obj.topFixes)
    ? obj.topFixes
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          title: String(f.title || '').slice(0, 200).trim(),
          action: String(f.action || '').slice(0, 280).trim(),
          impact: normalizeImpact(f.impact),
          expectedGain: String(f.expectedGain || '').slice(0, 60).trim(),
          rocketPath: String(f.rocketPath || '').slice(0, 200).trim(),
          caveats: String(f.caveats || '').slice(0, 400).trim(),
        }))
        .filter((f) => f.title && f.action)
        .slice(0, 50)            // hard safety cap
    : [];

  if (!summary && topFixes.length === 0) return null;
  return { summary, topFixes };
}

function normalizeImpact(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'high') return 'High';
  if (s === 'medium' || s === 'med') return 'Medium';
  if (s === 'low') return 'Low';
  return '';
}
