const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// ============================================
// Core API Call
// ============================================

// Vercel Pro gives us 300s per function. We give PSI nearly all of it —
// 295s — leaving a 5s margin so we catch the AbortSignal error and return
// a proper JSON 500 with details, instead of Vercel silently killing the
// function and returning a bare 504.
//
// We retry once on transient 5xx (Lighthouse crashes) — but only if there's
// at least 20s of budget left, otherwise the retry can't finish either and
// we're just burning the user's wait.
const DEFAULT_PSI_TIMEOUT_MS = 295000;
const MIN_RETRY_BUDGET_MS = 20000;
const RETRY_WAIT_MS = 2000;

export async function runPageSpeedAudit(url, strategy = 'mobile', opts = {}) {
  const { apiKey: overrideKey, timeoutMs = DEFAULT_PSI_TIMEOUT_MS } = opts;

  const apiKey = overrideKey || process.env.GOOGLE_PSI_API_KEY;
  if (!apiKey) throw new Error('No PageSpeed API key configured. Add one in Settings > Integrations.');

  const categoryUrl = `${PSI_API_URL}?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`;
  const startedAt = Date.now();

  async function attempt(remainingMs) {
    const attemptStart = Date.now();
    const response = await fetch(categoryUrl, { signal: AbortSignal.timeout(remainingMs) });
    const elapsed = Date.now() - attemptStart;
    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`PageSpeed API error (${response.status}) after ${elapsed}ms: ${body.slice(0, 200)}`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    const result = parseResponse(data);
    result._fetchMs = elapsed;
    return result;
  }

  try {
    return await attempt(timeoutMs);
  } catch (err) {
    // Only retry on transient 5xx (Lighthouse crashes). Timeouts are not
    // retried — if PSI couldn't finish in 295s, a retry won't either.
    const is5xx = err?.status && err.status >= 500;
    const isTransientMessage = /Lighthouse returned error|fetch failed|ECONNRESET/i.test(String(err?.message || ''));
    if (!is5xx && !isTransientMessage) throw err;

    // Don't retry if we'd blow past Vercel's 300s function budget.
    const elapsed = Date.now() - startedAt;
    const remaining = timeoutMs - elapsed - RETRY_WAIT_MS;
    if (remaining < MIN_RETRY_BUDGET_MS) throw err;

    await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
    const result = await attempt(remaining);
    result._retried = 1;
    return result;
  }
}

// Run both mobile and desktop audits for a site. Both use the retry-on-
// timeout strategy (see runPageSpeedAudit) so slow WP sites that need 45-60s
// on the first attempt complete via a fast cache-warm retry.
export async function runFullAudit(url, { apiKey } = {}) {
  const opts = apiKey ? { apiKey } : {};
  const [mobile, desktop] = await Promise.all([
    runPageSpeedAudit(url, 'mobile', opts),
    runPageSpeedAudit(url, 'desktop', opts),
  ]);

  return { mobile, desktop };
}

// ============================================
// Response Parsing
// ============================================

function parseResponse(data) {
  const lighthouse = data.lighthouseResult;
  if (!lighthouse) throw new Error('No Lighthouse result in API response');

  const categories = lighthouse.categories || {};
  const audits = lighthouse.audits || {};

  const scores = {
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
  };

  // Build weight map from category auditRefs (weights live there, not on audits)
  const weightMap = buildWeightMap(categories);
  // Track which audit IDs belong to the performance category
  const perfAuditIds = getPerfAuditIds(categories);

  const vitals = extractVitals(audits);
  const categorizedAudits = categorizeAudits(audits, vitals, weightMap, perfAuditIds);

  return {
    scores,
    vitals,
    audits: categorizedAudits,
  };
}

// Extract audit weights from category auditRefs
function buildWeightMap(categories) {
  const weights = {};
  for (const category of Object.values(categories)) {
    for (const ref of category.auditRefs || []) {
      if (ref.weight) {
        weights[ref.id] = { weight: ref.weight, group: ref.group || null };
      }
    }
  }
  return weights;
}

// Get audit IDs from the performance category
function getPerfAuditIds(categories) {
  const ids = new Set();
  for (const ref of categories.performance?.auditRefs || []) {
    ids.add(ref.id);
  }
  return ids;
}

// ============================================
// Vitals Extraction
// ============================================

function getNumeric(audit) {
  return audit?.numericValue ?? null;
}

function extractVitals(audits) {
  return {
    fcp: audits['first-contentful-paint']?.displayValue || null,
    lcp: audits['largest-contentful-paint']?.displayValue || null,
    tbt: audits['total-blocking-time']?.displayValue || null,
    cls: audits['cumulative-layout-shift']?.displayValue || null,
    si: audits['speed-index']?.displayValue || null,
    // Numeric values for threshold checks and snapshots (?? preserves 0)
    fcpMs: getNumeric(audits['first-contentful-paint']),
    lcpMs: getNumeric(audits['largest-contentful-paint']),
    tbtMs: getNumeric(audits['total-blocking-time']),
    clsValue: getNumeric(audits['cumulative-layout-shift']),
    siMs: getNumeric(audits['speed-index']),
  };
}

// ============================================
// Audit Categorization
// ============================================

// Categorization rules from CLAUDE.md:
// - Score < 50% → Fix Immediately
// - Score 50-89% → Future Improvement
// - Score 90%+ → Passing (not reported)
// - UPGRADE to Fix Immediately if: weight > 3 AND score < 70%
// - UPGRADE to Fix Immediately if: LCP > 4s OR TBT > 600ms

const CRITICAL_LCP_MS = 4000;
const CRITICAL_TBT_MS = 600;

function categorizeAudits(audits, vitals, weightMap, perfAuditIds) {
  const critical = [];
  const improvement = [];
  const optional = [];

  // Force critical for performance audits if core vitals exceed thresholds
  const hasVitalsCritical =
    (vitals.lcpMs !== null && vitals.lcpMs > CRITICAL_LCP_MS) ||
    (vitals.tbtMs !== null && vitals.tbtMs > CRITICAL_TBT_MS);

  for (const [id, audit] of Object.entries(audits)) {
    // Skip informational, not-applicable, or passing audits
    if (audit.score === null || audit.score === undefined) continue;
    if (audit.scoreDisplayMode === 'notApplicable') continue;
    if (audit.scoreDisplayMode === 'manual') continue;
    if (audit.scoreDisplayMode === 'informative') continue;

    const score = Math.round(audit.score * 100);

    // 90%+ is passing — skip
    if (score >= 90) continue;

    const weight = weightMap[id]?.weight || 0;
    const isPerfAudit = perfAuditIds.has(id);

    const entry = {
      id,
      title: audit.title,
      description: audit.description,
      score,
      displayValue: audit.displayValue || null,
      weight,
    };

    if (score < 50) {
      critical.push(entry);
    } else if (score < 70 && weight > 3) {
      // Upgrade: high-weight audit with mediocre score
      critical.push(entry);
    } else if (isPerfAudit && hasVitalsCritical && score < 70) {
      // Upgrade: performance audit when vitals are critical
      critical.push(entry);
    } else if (score >= 80) {
      // 80-89%: low priority, optional improvement
      optional.push(entry);
    } else {
      // 50-79%: future improvement
      improvement.push(entry);
    }
  }

  // Sort by score ascending (worst first) within each category
  critical.sort((a, b) => a.score - b.score);
  improvement.sort((a, b) => a.score - b.score);
  optional.sort((a, b) => a.score - b.score);

  return { critical, improvement, optional };
}

// ============================================
// Regression Detection
// ============================================

const REGRESSION_THRESHOLD = 10; // points

export function detectRegression(currentScores, previousSnapshot) {
  if (!previousSnapshot) return [];

  const regressions = [];
  const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];
  const dbFields = ['performance', 'accessibility', 'best_practices', 'seo'];

  for (let i = 0; i < categories.length; i++) {
    const current = currentScores[categories[i]];
    const previous = previousSnapshot[dbFields[i]];

    if (previous !== null && current !== null && previous - current >= REGRESSION_THRESHOLD) {
      regressions.push({
        category: categories[i],
        current,
        previous,
        drop: previous - current,
      });
    }
  }

  return regressions;
}

// ============================================
// Summary Helpers
// ============================================

export function getScoreColor(score) {
  if (score >= 90) return 'good';
  if (score >= 50) return 'average';
  return 'poor';
}

export function getScoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

export function formatAuditSummary(categorizedAudits) {
  return {
    criticalCount: categorizedAudits.critical.length,
    improvementCount: categorizedAudits.improvement.length,
    optionalCount: categorizedAudits.optional.length,
  };
}
