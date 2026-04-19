import { getScoreEmoji } from './pagespeed';
import { resolveLogoUrl } from './logos';
import { computeDeltas, formatDeltaPlain } from './deltas';

// ============================================
// Slack Webhook Client
// ============================================

export async function sendSlackMessage(webhookUrl, message) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Slack webhook returned ${response.status}: ${body}`);
  }
}

export async function sendSlackAlert(text) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  await sendSlackMessage(webhookUrl, { text });
}

// ============================================
// Helpers
// ============================================

function auditCounts(result) {
  const a = result?.audits;
  if (!a) return null;
  return {
    critical: Array.isArray(a.critical) ? a.critical.length : 0,
    improvement: Array.isArray(a.improvement) ? a.improvement.length : 0,
    optional: Array.isArray(a.optional) ? a.optional.length : 0,
  };
}

function formatCountsLine(counts) {
  if (!counts) return null;
  const parts = [];
  if (counts.critical > 0) parts.push(`🔴 ${counts.critical} critical`);
  if (counts.improvement > 0) parts.push(`🟡 ${counts.improvement} to improve`);
  if (counts.optional > 0) parts.push(`🟢 ${counts.optional} optional`);
  if (parts.length === 0) return '✅ No issues to fix';
  return parts.join('  ·  ');
}

// Renders a single score value with a delta suffix if present.
function scoreWithDelta(label, value, delta) {
  const base = `${label} ${value}`;
  if (delta === null || delta === undefined || delta === 0) return base;
  const arrow = delta > 0 ? '▲' : '▼';
  const sign = delta > 0 ? '+' : '';
  return `${base} ${arrow}${sign}${delta}`;
}

// Format all four scores for one strategy row, with deltas vs previous scan.
function formatScoresLine(result, prev) {
  const deltas = computeDeltas(result, prev);
  const parts = [
    `*Perf ${getScoreEmoji(result.performance)} ${result.performance}${deltaSuffix(deltas?.performance)}*`,
    scoreWithDelta('A11y', result.accessibility, deltas?.accessibility),
    scoreWithDelta('BP', result.best_practices, deltas?.bestPractices),
    scoreWithDelta('SEO', result.seo, deltas?.seo),
  ];
  return parts.join('  ·  ');
}

function deltaSuffix(delta) {
  if (delta === null || delta === undefined || delta === 0) return '';
  const arrow = delta > 0 ? ' ▲+' : ' ▼';
  return `${arrow}${delta > 0 ? delta : delta}`;
}

function formatVitals(result) {
  const parts = [];
  if (result.lcp) parts.push(`LCP ${result.lcp}`);
  if (result.fcp) parts.push(`FCP ${result.fcp}`);
  if (result.tbt) parts.push(`TBT ${result.tbt}`);
  if (result.cls) parts.push(`CLS ${result.cls}`);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

function countTotalCritical(siteResults) {
  let total = 0;
  for (const [, { results }] of siteResults) {
    const r = results.mobile || results.desktop;
    if (r?.audits?.critical?.length) total += r.audits.critical.length;
  }
  return total;
}

function escapeSlack(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================
// Main builder — Block Kit with logos, deltas, AI fixes
// ============================================

export function buildDailySummary(siteResults, regressions, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  const blocks = [];
  const totalSites = siteResults.size;
  const totalCritical = countTotalCritical(siteResults);

  // 1) Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '📊 Webpulse Scan Report', emoji: true },
  });

  // 2) Summary row with "Open Dashboard" button
  const summaryBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        `*${totalSites}* site${totalSites !== 1 ? 's' : ''} scanned` +
        (totalCritical > 0
          ? `  ·  🔴 *${totalCritical}* critical issue${totalCritical !== 1 ? 's' : ''}`
          : '  ·  ✅ No critical issues') +
        (aiSummariesBySiteId ? '  ·  🤖 AI analysis included' : ''),
    },
  };
  if (baseUrl) {
    summaryBlock.accessory = {
      type: 'button',
      text: { type: 'plain_text', text: 'Open Dashboard', emoji: true },
      url: baseUrl,
      style: 'primary',
      action_id: 'open_dashboard',
    };
  }
  blocks.push(summaryBlock);
  blocks.push({ type: 'divider' });

  // 3) One block per site
  let first = true;
  for (const [, { site, results, previous = {} }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;
    if (!mobile && !desktop) continue;

    if (!first) blocks.push({ type: 'divider' });
    first = false;

    const logoUrl = resolveLogoUrl(site, 64);

    // 3a) Site header: logo on the right, name + URL on the left
    const headerBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: `*<${site.url}|${escapeSlack(site.name)}>*\n${escapeSlack(site.url)}` },
    };
    if (logoUrl) {
      headerBlock.accessory = {
        type: 'image',
        image_url: logoUrl,
        alt_text: `${site.name} logo`,
      };
    }
    blocks.push(headerBlock);

    // 3b) Mobile block
    if (mobile) {
      const lines = [`📱 *Mobile*   ${formatScoresLine(mobile, previous?.mobile)}`];
      const vitals = formatVitals(mobile);
      if (vitals) lines.push(`   _${vitals}_`);
      const counts = formatCountsLine(auditCounts(mobile));
      if (counts) lines.push(`   ${counts}`);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      });
    }

    // 3c) Desktop block
    if (desktop) {
      const lines = [`🖥️ *Desktop*   ${formatScoresLine(desktop, previous?.desktop)}`];
      const vitals = formatVitals(desktop);
      if (vitals) lines.push(`   _${vitals}_`);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      });
    }

    // 3d) View Report action row
    if (baseUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Full Report', emoji: true },
            url: `${baseUrl}/site/${site.id}`,
            action_id: `view_${site.id}`,
          },
        ],
      });
    }

    // 3e) AI top fixes (if provided)
    if (aiSummariesBySiteId && aiSummariesBySiteId[site.id]) {
      const ai = aiSummariesBySiteId[site.id];
      const aiLines = ['🤖 *Top fixes*'];
      if (ai.summary) aiLines.push(`_${escapeSlack(ai.summary)}_`);
      for (const fix of ai.topFixes || []) {
        aiLines.push(`• *${escapeSlack(fix.title)}*`);
        aiLines.push(`   ↳ ${escapeSlack(fix.action)}`);
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: aiLines.join('\n') },
      });
    }
  }

  // 4) Regression alerts
  if (regressions && regressions.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '⚠️ Regression Alerts', emoji: true },
    });

    const regLines = [];
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        regLines.push(
          `⬇️ *${escapeSlack(site.name)}* — ${reg.category}: *${reg.previous}* → *${reg.current}* (−${reg.drop})`
        );
      }
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: regLines.join('\n') },
    });
  }

  // 5) Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text:
          `🕒 Scanned ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC` +
          (baseUrl ? `  ·  <${baseUrl}|Open Dashboard>` : ''),
      },
    ],
  });

  // Slack Block Kit has a 50-block limit
  if (blocks.length > 49) {
    const truncated = blocks.slice(0, 48);
    truncated.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_…and ${blocks.length - 48} more items (truncated)_` },
      ],
    });
    return { blocks: truncated };
  }

  return { blocks };
}

// ============================================
// Text-only fallback
// ============================================

export function buildDailySummaryText(siteResults, regressions, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  const lines = ['*📊 Webpulse Scan Report*'];
  if (baseUrl) lines.push(`<${baseUrl}|Open Dashboard>`);
  lines.push('');

  for (const [, { site, results, previous = {} }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;
    if (!mobile && !desktop) continue;

    lines.push(`*<${site.url}|${escapeSlack(site.name)}>*`);

    if (mobile) {
      lines.push(`   📱 Mobile: ${formatScoresLine(mobile, previous?.mobile)}`);
      const v = formatVitals(mobile);
      if (v) lines.push(`      _${v}_`);
      const c = formatCountsLine(auditCounts(mobile));
      if (c) lines.push(`      ${c}`);
    }

    if (desktop) {
      lines.push(`   🖥️ Desktop: ${formatScoresLine(desktop, previous?.desktop)}`);
      const v = formatVitals(desktop);
      if (v) lines.push(`      _${v}_`);
    }

    if (aiSummariesBySiteId && aiSummariesBySiteId[site.id]) {
      const ai = aiSummariesBySiteId[site.id];
      lines.push(`   🤖 Top fixes:`);
      if (ai.summary) lines.push(`      _${escapeSlack(ai.summary)}_`);
      for (const fix of ai.topFixes || []) {
        lines.push(`      • *${escapeSlack(fix.title)}*`);
        lines.push(`         ↳ ${escapeSlack(fix.action)}`);
      }
    }

    if (baseUrl) {
      lines.push(`   <${baseUrl}/site/${site.id}|View full report →>`);
    }

    lines.push('');
  }

  if (regressions && regressions.length > 0) {
    lines.push('⚠️ *Regression Alerts*');
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        lines.push(
          `   ⬇️ ${escapeSlack(site.name)} — ${reg.category}: ${reg.previous} → ${reg.current} (−${reg.drop})`
        );
      }
    }
  }

  return { text: lines.join('\n') };
}

export function buildRegressionAlert(siteName, regressions) {
  const lines = [`🚨 *Regression Alert: ${escapeSlack(siteName)}*`, ''];
  for (const reg of regressions) {
    lines.push(`⬇️ ${reg.category}: *${reg.previous}* → *${reg.current}* (−${reg.drop})`);
  }
  return { text: lines.join('\n') };
}

// Kept for any old imports
export { formatDeltaPlain };
