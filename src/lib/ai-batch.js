// Shared helper: run compact AI analysis for every site in a scan batch, in parallel.
// Used by both the schedule runner and manual Send-to-Slack so Slack messages
// and the dashboard checklist stay in sync.

import { resolveAIConfig, callAIProvider, buildCompactPrompt, parseCompactResponse } from './ai';
import { upsertSiteFixes } from './db';
import { logEvent } from './logs';

// siteResults: Map<siteId, { site, results: { mobile, desktop } }>
// Returns { [siteId]: { summary, topFixes } } | null (if no AI configured).
export async function runCompactAIForSites(teamId, siteResults, { persist = true } = {}) {
  const { provider, apiKey } = await resolveAIConfig(teamId);
  if (!apiKey) {
    await logEvent({
      teamId,
      type: 'ai',
      level: 'warn',
      message: 'AI analysis skipped — no API key configured',
      metadata: { hint: 'Add AI provider key in Settings > Integrations' },
    });
    return null;
  }

  const jobs = [];
  for (const [siteId, { site, results }] of siteResults) {
    const mobile = results?.mobile;
    if (!mobile) continue;
    jobs.push(analyzeOneSite(teamId, provider, apiKey, siteId, site, mobile, persist));
  }

  const outcomes = await Promise.allSettled(jobs);
  const byId = {};
  for (const o of outcomes) {
    if (o.status === 'fulfilled' && o.value?.parsed) {
      byId[o.value.siteId] = o.value.parsed;
    }
  }
  return byId;
}

async function analyzeOneSite(teamId, provider, apiKey, siteId, site, mobile, persist) {
  const startedAt = Date.now();
  try {
    const prompt = buildCompactPrompt(site, mobile);
    // Per-site cap: 40s. With parallel sites this still fits inside the
    // function's max duration; a stuck provider call can't stall the batch.
    const text = await callAIProvider(provider, apiKey, prompt, 2500, { timeoutMs: 40000 });
    const parsed = parseCompactResponse(text);
    if (!parsed) {
      await logEvent({
        teamId,
        type: 'ai',
        level: 'warn',
        message: `AI returned unparseable response for ${site.name}`,
        metadata: { siteId, provider, durationMs: Date.now() - startedAt, preview: text.slice(0, 200) },
      });
      return { siteId, parsed: null };
    }

    if (persist && parsed.topFixes?.length) {
      try {
        await upsertSiteFixes(siteId, parsed.topFixes);
      } catch (err) {
        console.error(`upsertSiteFixes failed for site ${siteId}:`, err.message);
      }
    }

    await logEvent({
      teamId,
      type: 'ai',
      level: 'info',
      message: `AI summary generated for ${site.name} (${parsed.topFixes.length} fixes)`,
      metadata: { siteId, provider, durationMs: Date.now() - startedAt, fixes: parsed.topFixes.length },
    });
    return { siteId, parsed };
  } catch (err) {
    await logEvent({
      teamId,
      type: 'ai',
      level: 'error',
      message: `AI call failed for ${site.name}: ${err.message}`,
      metadata: { siteId, provider, error: err.message, durationMs: Date.now() - startedAt },
    });
    return { siteId, parsed: null };
  }
}
