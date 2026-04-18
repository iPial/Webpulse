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

// Format a vitals line from a result object (fcp, lcp, tbt, cls are display strings like "2.1 s")
function formatVitals(result) {
  const parts = [];
  if (result.lcp) parts.push(`LCP: ${result.lcp}`);
  if (result.fcp) parts.push(`FCP: ${result.fcp}`);
  if (result.tbt) parts.push(`TBT: ${result.tbt}`);
  if (result.cls) parts.push(`CLS: ${result.cls}`);
  return parts.length > 0 ? parts.join('  \u2022  ') : null;
}

// Format a scores line with dot separators
function formatScores(result) {
  return (
    `Performance: ${getScoreEmoji(result.performance)} ${result.performance}  \u2022  ` +
    `Accessibility: ${result.accessibility}  \u2022  ` +
    `Best Practices: ${result.best_practices}  \u2022  ` +
    `SEO: ${result.seo}`
  );
}

// Build the daily scan summary for Slack (Block Kit format)
export function buildDailySummary(siteResults, regressions) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '\ud83d\udcca Webpulse Scan Report', emoji: true },
    },
    { type: 'divider' },
  ];

  let siteIndex = 0;
  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;

    if (!mobile && !desktop) continue;

    // Add divider between sites (not before the first one)
    if (siteIndex > 0) {
      blocks.push({ type: 'divider' });
    }

    const lines = [`\ud83c\udf10 *${escapeSlack(site.name)}*`];

    if (mobile) {
      lines.push('');
      lines.push('\ud83d\udcf1 *Mobile*');
      lines.push(formatScores(mobile));
      const vitals = formatVitals(mobile);
      if (vitals) lines.push(vitals);
    }

    if (desktop) {
      lines.push('');
      lines.push('\ud83d\udda5\ufe0f *Desktop*');
      lines.push(formatScores(desktop));
      const vitals = formatVitals(desktop);
      if (vitals) lines.push(vitals);
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    });

    siteIndex++;
  }

  // Regression alerts
  if (regressions.length > 0) {
    blocks.push({ type: 'divider' });

    const regLines = ['\u26a0\ufe0f *Regression Alerts*', ''];
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        regLines.push(
          `\ud83d\udd3b *${escapeSlack(site.name)}* \u2014 ${reg.category} dropped *${reg.drop}* points  (${reg.previous} \u2192 ${reg.current})`
        );
      }
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: regLines.join('\n') },
    });
  }

  // Timestamp footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `\ud83d\udd52 Scanned at ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      },
    ],
  });

  // Slack Block Kit has a 50-block limit — truncate and warn if exceeded
  if (blocks.length > 49) {
    const truncated = blocks.slice(0, 48);
    truncated.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_\u2026and ${blocks.length - 48} more items (truncated due to Slack limits)_` },
      ],
    });
    return { blocks: truncated };
  }

  return { blocks };
}

// Build a simple text-only summary (for webhooks that don't support blocks)
export function buildDailySummaryText(siteResults, regressions) {
  const lines = ['\ud83d\udcca *Webpulse Scan Report*', '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', ''];

  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;

    if (!mobile && !desktop) continue;

    lines.push(`\ud83c\udf10 *${escapeSlack(site.name)}*`);

    if (mobile) {
      lines.push('');
      lines.push('\ud83d\udcf1 *Mobile*');
      lines.push(formatScores(mobile));
      const vitals = formatVitals(mobile);
      if (vitals) lines.push(vitals);
    }

    if (desktop) {
      lines.push('');
      lines.push('\ud83d\udda5\ufe0f *Desktop*');
      lines.push(formatScores(desktop));
      const vitals = formatVitals(desktop);
      if (vitals) lines.push(vitals);
    }

    lines.push('');
    lines.push('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
    lines.push('');
  }

  if (regressions.length > 0) {
    lines.push('\u26a0\ufe0f *Regression Alerts*');
    lines.push('');
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        lines.push(
          `\ud83d\udd3b *${escapeSlack(site.name)}* \u2014 ${reg.category} dropped *${reg.drop}* points  (${reg.previous} \u2192 ${reg.current})`
        );
      }
    }
    lines.push('');
  }

  lines.push(`\ud83d\udd52 Scanned at ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`);

  return { text: lines.join('\n') };
}

// Build a regression alert for immediate notification
export function buildRegressionAlert(siteName, regressions) {
  const lines = [
    `\ud83d\udea8 *Regression Alert: ${escapeSlack(siteName)}*`,
    '',
  ];

  for (const reg of regressions) {
    lines.push(
      `\ud83d\udd3b ${reg.category}: *${reg.previous}* \u2192 *${reg.current}*  (\u2212${reg.drop} points)`
    );
  }

  return { text: lines.join('\n') };
}

// Escape special Slack mrkdwn characters in user-provided text
function escapeSlack(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
