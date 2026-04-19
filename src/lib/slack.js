import { getScoreEmoji } from './pagespeed';

// ============================================
// Slack Webhook Client
// ============================================

// Send a message to a Slack webhook URL
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

// Send using the global SLACK_WEBHOOK_URL env var (fallback for teams without custom webhook)
export async function sendSlackAlert(text) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // Slack not configured — skip silently

  await sendSlackMessage(webhookUrl, { text });
}

// ============================================
// Message Builders
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
  return parts.join('   ');
}

function formatScores(result) {
  return (
    `*Perf ${getScoreEmoji(result.performance)} ${result.performance}*  ` +
    `·  A11y ${result.accessibility}  ` +
    `·  BP ${result.best_practices}  ` +
    `·  SEO ${result.seo}`
  );
}

function formatVitals(result) {
  const parts = [];
  if (result.lcp) parts.push(`LCP ${result.lcp}`);
  if (result.fcp) parts.push(`FCP ${result.fcp}`);
  if (result.tbt) parts.push(`TBT ${result.tbt}`);
  if (result.cls) parts.push(`CLS ${result.cls}`);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

// Build the scan summary for Slack (Block Kit format).
// Each site gets: name, mobile/desktop scores, issue counts, optional AI top fixes, "View Report" link.
export function buildDailySummary(siteResults, regressions, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  const blocks = [];

  // Header
  const totalSites = siteResults.size;
  const totalCritical = countTotalCritical(siteResults);

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '📊 Webpulse Scan Report', emoji: true },
  });

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

  // Open Dashboard button on the summary row
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

  // Per-site sections
  let first = true;
  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;
    if (!mobile && !desktop) continue;

    if (!first) blocks.push({ type: 'divider' });
    first = false;

    // Title with URL
    const lines = [`🌐 *<${site.url}|${escapeSlack(site.name)}>*`];

    if (mobile) {
      lines.push('');
      lines.push(`📱 *Mobile*   ${formatScores(mobile)}`);
      const vitals = formatVitals(mobile);
      if (vitals) lines.push(`_${vitals}_`);
      const counts = formatCountsLine(auditCounts(mobile));
      if (counts) lines.push(counts);
    }

    if (desktop) {
      lines.push('');
      lines.push(`🖥️ *Desktop*   ${formatScores(desktop)}`);
      const vitals = formatVitals(desktop);
      if (vitals) lines.push(`_${vitals}_`);
    }

    const sectionBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    };

    // "View Report" button — only if baseUrl configured
    if (baseUrl) {
      sectionBlock.accessory = {
        type: 'button',
        text: { type: 'plain_text', text: 'View Report', emoji: true },
        url: `${baseUrl}/site/${site.id}`,
        action_id: `view_${site.id}`,
      };
    }

    blocks.push(sectionBlock);

    // 🤖 AI top fixes for this site, if available
    if (aiSummariesBySiteId && aiSummariesBySiteId[site.id]) {
      const ai = aiSummariesBySiteId[site.id];
      const aiLines = ['🤖 *Top fixes*'];
      if (ai.summary) aiLines.push(`_${escapeSlack(ai.summary)}_`);
      for (const fix of ai.topFixes || []) {
        aiLines.push(`• *${escapeSlack(fix.title)}* — ${escapeSlack(fix.action)}`);
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: aiLines.join('\n') },
      });
    }
  }

  // Regression alerts
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

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🕒 Scanned ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC` +
          (baseUrl ? `  ·  <${baseUrl}|Open Dashboard>` : ''),
      },
    ],
  });

  // Slack Block Kit has a 50-block limit — truncate and warn if exceeded
  if (blocks.length > 49) {
    const truncated = blocks.slice(0, 48);
    truncated.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_…and ${blocks.length - 48} more items (truncated due to Slack limits)_` },
      ],
    });
    return { blocks: truncated };
  }

  return { blocks };
}

// Text-only fallback for webhooks that don't support blocks
export function buildDailySummaryText(siteResults, regressions, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  const lines = ['*📊 Webpulse Scan Report*'];
  if (baseUrl) lines.push(`<${baseUrl}|Open Dashboard>`);
  lines.push('');

  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;
    if (!mobile && !desktop) continue;

    lines.push(`🌐 *<${site.url}|${escapeSlack(site.name)}>*`);

    if (mobile) {
      lines.push(`   📱 Mobile: ${formatScores(mobile)}`);
      const v = formatVitals(mobile);
      if (v) lines.push(`      _${v}_`);
      const c = formatCountsLine(auditCounts(mobile));
      if (c) lines.push(`      ${c}`);
    }

    if (desktop) {
      lines.push(`   🖥️ Desktop: ${formatScores(desktop)}`);
      const v = formatVitals(desktop);
      if (v) lines.push(`      _${v}_`);
    }

    if (aiSummariesBySiteId && aiSummariesBySiteId[site.id]) {
      const ai = aiSummariesBySiteId[site.id];
      lines.push(`   🤖 Top fixes:`);
      if (ai.summary) lines.push(`      _${escapeSlack(ai.summary)}_`);
      for (const fix of ai.topFixes || []) {
        lines.push(`      • *${escapeSlack(fix.title)}* — ${escapeSlack(fix.action)}`);
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

// Build a regression alert for immediate notification
export function buildRegressionAlert(siteName, regressions) {
  const lines = [`🚨 *Regression Alert: ${escapeSlack(siteName)}*`, ''];

  for (const reg of regressions) {
    lines.push(`⬇️ ${reg.category}: *${reg.previous}* → *${reg.current}* (−${reg.drop})`);
  }

  return { text: lines.join('\n') };
}

function countTotalCritical(siteResults) {
  let total = 0;
  for (const [, { results }] of siteResults) {
    const r = results.mobile || results.desktop;
    if (r?.audits?.critical?.length) total += r.audits.critical.length;
  }
  return total;
}

// Escape special Slack mrkdwn characters in user-provided text
function escapeSlack(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
