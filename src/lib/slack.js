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

// Build the daily scan summary for Slack (Block Kit format)
export function buildDailySummary(siteResults, regressions) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'PageSpeed Daily Report' },
    },
  ];

  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;

    if (!mobile && !desktop) continue;

    const siteLines = [];

    if (mobile) {
      siteLines.push(
        `${getScoreEmoji(mobile.performance)} *${escapeSlack(site.name)}*\n` +
        `  Mobile: Perf *${mobile.performance}* | A11y ${mobile.accessibility} | ` +
        `BP ${mobile.best_practices} | SEO ${mobile.seo}`
      );
    }

    if (desktop) {
      siteLines.push(
        `  Desktop: Perf *${desktop.performance}* | A11y ${desktop.accessibility} | ` +
        `BP ${desktop.best_practices} | SEO ${desktop.seo}`
      );
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: siteLines.join('\n') },
    });
  }

  // Regression alerts
  if (regressions.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: 'Regression Alerts' },
    });

    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: *${escapeSlack(site.name)}* — ${reg.category} dropped *${reg.drop}* points (${reg.previous} → ${reg.current})`,
          },
        });
      }
    }
  }

  // Timestamp footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Scanned at ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
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

// Build a simple text-only summary (for webhooks that don't support blocks)
export function buildDailySummaryText(siteResults, regressions) {
  const lines = ['*PageSpeed Daily Report*\n'];

  for (const [, { site, results }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;

    if (mobile) {
      lines.push(
        `${getScoreEmoji(mobile.performance)} *${escapeSlack(site.name)}* (mobile): ` +
        `Perf ${mobile.performance} | A11y ${mobile.accessibility} | ` +
        `BP ${mobile.best_practices} | SEO ${mobile.seo}`
      );
    }

    if (desktop) {
      lines.push(
        `  Desktop: Perf ${desktop.performance} | A11y ${desktop.accessibility} | ` +
        `BP ${desktop.best_practices} | SEO ${desktop.seo}`
      );
    }
  }

  if (regressions.length > 0) {
    lines.push('\n*Regression Alerts:*');
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        lines.push(
          `  :warning: *${escapeSlack(site.name)}* — ${reg.category} dropped ${reg.drop} points ` +
          `(${reg.previous} → ${reg.current})`
        );
      }
    }
  }

  return { text: lines.join('\n') };
}

// Build a regression alert for immediate notification
export function buildRegressionAlert(siteName, regressions) {
  const lines = [`:rotating_light: *Regression Alert: ${escapeSlack(siteName)}*\n`];

  for (const reg of regressions) {
    lines.push(
      `  ${reg.category}: *${reg.previous}* → *${reg.current}* (−${reg.drop} points)`
    );
  }

  return { text: lines.join('\n') };
}

// Escape special Slack mrkdwn characters in user-provided text
function escapeSlack(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
