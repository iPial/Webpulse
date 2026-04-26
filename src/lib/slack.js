import { resolveLogoUrl } from './logos';
import { computeDeltas } from './deltas';

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
// Vital thresholds + plain-English descriptions
// ============================================

// Parse display values like "7.5 s", "2,170 ms", "0.043" → number in ms/seconds/unitless
function parseVitalMs(displayValue) {
  if (!displayValue) return null;
  const s = String(displayValue).toLowerCase().replace(/,/g, '').trim();
  const num = parseFloat(s);
  if (isNaN(num)) return null;
  if (s.endsWith('ms')) return num;
  if (s.endsWith('s')) return num * 1000;
  return num; // CLS is unitless
}

function vitalStatus(metric, displayValue) {
  const v = parseVitalMs(displayValue);
  if (v === null) return { emoji: '⚪', label: 'no data' };

  const thresholds = {
    lcp: { good: 2500, poor: 4000 },   // ms
    fcp: { good: 1800, poor: 3000 },   // ms
    tbt: { good: 200, poor: 600 },     // ms
    cls: { good: 0.1, poor: 0.25 },    // unitless
    si:  { good: 3400, poor: 5800 },   // ms
  };
  const t = thresholds[metric];
  if (!t) return { emoji: '⚪', label: 'unknown' };
  if (v <= t.good) return { emoji: '🟢', label: 'good' };
  if (v <= t.poor) return { emoji: '🟡', label: 'needs work' };
  return { emoji: '🔴', label: 'poor' };
}

// Plain-English description per vital with target
function vitalDescription(metric, displayValue) {
  const status = vitalStatus(metric, displayValue);
  const labels = {
    lcp: ['Largest image/text visible in', 'target: under 2.5s'],
    fcp: ['First content appears in', 'target: under 1.8s'],
    tbt: ['Scripts block the page for', 'target: under 200ms'],
    cls: ['Layout shift score:', 'target: under 0.1 (lower is better)'],
    si:  ['Page content visible in', 'target: under 3.4s'],
  };
  const [prefix, target] = labels[metric] || [metric, ''];
  return `${status.emoji} ${prefix} ${displayValue} _(${target})_`;
}

function scoreEmojiFor(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

function deltaText(delta) {
  if (delta === null || delta === undefined || delta === 0) return '—';
  const arrow = delta > 0 ? '▲' : '▼';
  const sign = delta > 0 ? '+' : '';
  return `${arrow} ${sign}${delta}`;
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
// Scan Report — Option A "Scorecard" (plain language, side-by-side)
// ============================================

export function buildDailySummary(siteResults, regressions, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  const blocks = [];
  const totalSites = siteResults.size;
  const totalCritical = countTotalCritical(siteResults);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // 1) Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `📊 Webpulse Scan — ${dateStr}`, emoji: true },
  });

  // 2) Summary row with Open Dashboard button
  const summaryText =
    `*${totalSites}* site${totalSites !== 1 ? 's' : ''} scanned` +
    `  ·  ${totalCritical > 0 ? `🔴 *${totalCritical}* critical issues` : '✅ No critical issues'}` +
    (aiSummariesBySiteId ? '  ·  🤖 AI analysis included' : '');

  const summaryBlock = {
    type: 'section',
    text: { type: 'mrkdwn', text: summaryText },
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

  // 3) Per-site scorecard
  let first = true;
  for (const [, { site, results, previous = {} }] of siteResults) {
    const mobile = results.mobile;
    const desktop = results.desktop;
    if (!mobile && !desktop) continue;

    if (!first) blocks.push({ type: 'divider' });
    first = false;

    pushSiteCard(blocks, site, mobile, desktop, previous, baseUrl);

    // AI top fixes
    if (aiSummariesBySiteId && aiSummariesBySiteId[site.id]) {
      pushAIFixesSection(blocks, site, aiSummariesBySiteId[site.id], baseUrl);
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
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: regLines.join('\n') } });
  }

  // 5) Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text:
          `🕒 ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC` +
          (baseUrl ? `  ·  <${baseUrl}|Open Dashboard>` : ''),
      },
    ],
  });

  // Slack 50-block limit guard
  if (blocks.length > 49) {
    const truncated = blocks.slice(0, 48);
    truncated.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_…and ${blocks.length - 48} more items (truncated)_` }],
    });
    return { blocks: truncated };
  }
  return { blocks };
}

function pushSiteCard(blocks, site, mobile, desktop, previous, baseUrl) {
  const logoUrl = resolveLogoUrl(site, 48);

  // Site name header (context block so logo renders tiny inline)
  const headerElements = [];
  if (logoUrl) headerElements.push({ type: 'image', image_url: logoUrl, alt_text: site.name });
  headerElements.push({
    type: 'mrkdwn',
    text: `*<${site.url}|${escapeSlack(site.name)}>*  ·  ${escapeSlack(site.url)}`,
  });
  blocks.push({ type: 'context', elements: headerElements });

  // Scores — Mobile & Desktop in a two-field section (Slack renders fields in 2 columns)
  const scoresSection = { type: 'section', fields: [] };
  if (mobile) {
    scoresSection.fields.push({
      type: 'mrkdwn',
      text:
        `*📱 MOBILE*\n` +
        formatScoreLines(mobile, previous?.mobile),
    });
  }
  if (desktop) {
    scoresSection.fields.push({
      type: 'mrkdwn',
      text:
        `*🖥️ DESKTOP*\n` +
        formatScoreLines(desktop, previous?.desktop),
    });
  }
  if (scoresSection.fields.length > 0) blocks.push(scoresSection);

  // Vitals explained in plain English — mobile first (primary metric)
  const primary = mobile || desktop;
  const strategyLabel = mobile ? 'mobile' : 'desktop';
  const vitalLines = [`*Loading speed on ${strategyLabel}:*`];
  if (primary.lcp) vitalLines.push(`• ${vitalDescription('lcp', primary.lcp)}`);
  if (primary.fcp) vitalLines.push(`• ${vitalDescription('fcp', primary.fcp)}`);
  if (primary.tbt) vitalLines.push(`• ${vitalDescription('tbt', primary.tbt)}`);
  if (primary.cls) vitalLines.push(`• ${vitalDescription('cls', primary.cls)}`);

  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: vitalLines.join('\n') } });

  // Issue counts
  const a = primary.audits || {};
  const crit = Array.isArray(a.critical) ? a.critical.length : 0;
  const impr = Array.isArray(a.improvement) ? a.improvement.length : 0;
  if (crit > 0 || impr > 0) {
    const parts = [];
    if (crit > 0) parts.push(`🔴 *${crit} critical issues* blocking the load — fix these first`);
    if (impr > 0) parts.push(`🟡 ${impr} opportunities to improve`);
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: parts.join('\n') } });
  } else {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `✅ No critical issues on this site` } });
  }

  // View Full Report button
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
}

// Render 4 score lines for one strategy with deltas
function formatScoreLines(result, prev) {
  const deltas = computeDeltas(result, prev);
  const rows = [
    scoreRow('Performance', result.performance, deltas?.performance, true),
    scoreRow('Accessibility', result.accessibility, deltas?.accessibility),
    scoreRow('Best Practices', result.best_practices, deltas?.bestPractices),
    scoreRow('SEO', result.seo, deltas?.seo),
  ];
  return rows.join('\n');
}

function scoreRow(label, value, delta, withEmoji = false) {
  const emoji = withEmoji ? `${scoreEmojiFor(value)} ` : '';
  const deltaStr = deltaText(delta);
  return `${label}  ${emoji}*${value}*  ${deltaStr}`;
}

function pushAIFixesSection(blocks, site, ai, baseUrl) {
  const topN = 3;
  const allFixes = ai.topFixes || [];
  const top = allFixes.slice(0, topN);
  const overflow = allFixes.length - top.length;
  if (!ai.summary && top.length === 0) return;

  const lines = [`🤖 *Top ${top.length} things to fix (AI analysis)*`];
  if (ai.summary) {
    lines.push(`_${escapeSlack(ai.summary)}_`);
    lines.push('');
  }

  top.forEach((fix, i) => {
    const impact = fix.impact ? `  —  *${fix.impact} impact*` : '';
    lines.push(`*${i + 1}. ${escapeSlack(fix.title)}*${impact}`);
    if (fix.rocketPath) {
      lines.push(`   WP Rocket: \`${escapeSlack(fix.rocketPath)}\``);
    }
    if (fix.action) {
      lines.push(`   Why: ${escapeSlack(fix.action)}`);
    }
    lines.push(''); // spacer between fixes
  });

  if (overflow > 0) {
    const more = baseUrl
      ? `<${baseUrl}/site/${site.id}|+${overflow} more in dashboard →>`
      : `+${overflow} more in dashboard`;
    lines.push(more);
  }

  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } });
}

// ============================================
// Text-only fallback (webhooks without Block Kit)
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
      lines.push(`   📱 Mobile:`);
      const m = formatScoreLines(mobile, previous?.mobile).split('\n').map((l) => '      ' + l);
      lines.push(...m);
    }
    if (desktop) {
      lines.push(`   🖥️ Desktop:`);
      const d = formatScoreLines(desktop, previous?.desktop).split('\n').map((l) => '      ' + l);
      lines.push(...d);
    }
    if (baseUrl) lines.push(`   <${baseUrl}/site/${site.id}|View full report →>`);
    lines.push('');
  }

  if (regressions && regressions.length > 0) {
    lines.push('⚠️ *Regression Alerts*');
    for (const { site, regressions: siteRegs } of regressions) {
      for (const reg of siteRegs) {
        lines.push(`   ⬇️ ${escapeSlack(site.name)} — ${reg.category}: ${reg.previous} → ${reg.current} (−${reg.drop})`);
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

// ============================================
// Trend Report — Week-over-week summary (Option 1)
// ============================================

// Input shape:
//   trendBySiteId: {
//     [siteId]: {
//       site: { name, url, id },
//       thisWeek: { avgPerf, avgA11y, avgBP, avgSEO, avgLcpMs, avgFcpMs, avgTbtMs, avgCls, criticalCount },
//       lastWeek: { avgPerf, avgA11y, avgBP, avgSEO, avgLcpMs, avgFcpMs, avgTbtMs, avgCls, criticalCount },
//       bestDay: { dateIso, strategy, perf },
//       worstDay: { dateIso, strategy, perf, cause? },
//     }
//   }
export function buildTrendReport(trendBySiteId, { baseUrl = '', periodStart, periodEnd, windowDays = 7 } = {}) {
  const blocks = [];
  const siteIds = Object.keys(trendBySiteId);
  const sites = siteIds.map((id) => trendBySiteId[id]);

  const startDate = periodStart ? new Date(periodStart) : new Date(Date.now() - windowDays * 86400000);
  const endDate = periodEnd ? new Date(periodEnd) : new Date();

  const dateRange =
    `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–` +
    `${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // 1) Header — title varies by window length so weekly/monthly read naturally
  const headerTitle =
    windowDays === 30
      ? '📈 Webpulse Monthly Report — Last 30 days vs prior 30'
      : windowDays === 7
      ? '📈 Webpulse Weekly Report — Last 7 days vs prior week'
      : `📈 Webpulse Trend Report — Last ${windowDays} days vs prior ${windowDays}`;
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: headerTitle, emoji: true },
  });

  // 2) Summary
  const totalScans = sites.reduce((acc, s) => acc + (s.thisWeek?.scanCount || 0), 0);
  const summaryBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${dateRange}  ·  *${sites.length}* site${sites.length !== 1 ? 's' : ''}  ·  *${totalScans}* scans this week`,
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

  // 3) Per-site trend
  let globalBest = null;
  let globalWorst = null;
  let first = true;
  for (const entry of sites) {
    if (!entry?.site) continue;
    if (!first) blocks.push({ type: 'divider' });
    first = false;

    const logoUrl = resolveLogoUrl(entry.site, 48);
    const headerElements = [];
    if (logoUrl) headerElements.push({ type: 'image', image_url: logoUrl, alt_text: entry.site.name });
    headerElements.push({
      type: 'mrkdwn',
      text: `*<${entry.site.url}|${escapeSlack(entry.site.name)}>*`,
    });
    blocks.push({ type: 'context', elements: headerElements });

    const lines = [];

    // Scores comparison
    const tw = entry.thisWeek || {};
    const lw = entry.lastWeek || {};
    lines.push(`*Scores (weekly average)*`);
    lines.push(trendRow('Mobile Performance', lw.avgPerf, tw.avgPerf));
    lines.push(trendRow('Desktop Performance', lw.avgDesktopPerf, tw.avgDesktopPerf));
    lines.push(trendRow('Accessibility', lw.avgA11y, tw.avgA11y));
    lines.push(trendRow('SEO', lw.avgSEO, tw.avgSEO));
    lines.push('');

    // Vitals comparison (mobile)
    lines.push(`*Core Vitals (mobile average)*`);
    if (lw.avgLcpMs != null || tw.avgLcpMs != null)
      lines.push(vitalTrendRow('LCP', lw.avgLcpMs, tw.avgLcpMs, 'ms', true));
    if (lw.avgTbtMs != null || tw.avgTbtMs != null)
      lines.push(vitalTrendRow('TBT', lw.avgTbtMs, tw.avgTbtMs, 'ms', true));
    if (lw.avgCls != null || tw.avgCls != null)
      lines.push(vitalTrendRow('CLS', lw.avgCls, tw.avgCls, '', true, 3));
    lines.push('');

    // Critical issues delta
    if (tw.criticalCount != null && lw.criticalCount != null) {
      const delta = tw.criticalCount - lw.criticalCount;
      const verdict =
        delta === 0 ? '— unchanged' :
        delta > 0  ? `▼ *${delta}* new issue${delta !== 1 ? 's' : ''} appeared` :
                     `▲ *${Math.abs(delta)}* issue${Math.abs(delta) !== 1 ? 's' : ''} resolved`;
      lines.push(`*Critical issues:*  ${lw.criticalCount}  →  *${tw.criticalCount}*  ${verdict}`);
    }

    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } });

    if (baseUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View History', emoji: true },
            url: `${baseUrl}/history?site=${entry.site.id}`,
            action_id: `history_${entry.site.id}`,
          },
        ],
      });
    }

    // Track best/worst day across all sites
    if (entry.bestDay && (!globalBest || entry.bestDay.perf > globalBest.perf)) {
      globalBest = { ...entry.bestDay, siteName: entry.site.name };
    }
    if (entry.worstDay && (!globalWorst || entry.worstDay.perf < globalWorst.perf)) {
      globalWorst = { ...entry.worstDay, siteName: entry.site.name };
    }
  }

  // 4) Best/worst day summary
  if (globalBest || globalWorst) {
    blocks.push({ type: 'divider' });
    const highlights = [];
    if (globalBest) {
      const d = new Date(globalBest.dateIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      highlights.push(`📊 *Best day:* ${d} — ${escapeSlack(globalBest.siteName)} hit ${globalBest.strategy} performance *${globalBest.perf}*`);
    }
    if (globalWorst) {
      const d = new Date(globalWorst.dateIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const cause = globalWorst.cause ? ` (${globalWorst.cause})` : '';
      highlights.push(`📉 *Worst day:* ${d} — ${escapeSlack(globalWorst.siteName)} dropped to *${globalWorst.perf}*${cause}`);
    }
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: highlights.join('\n') } });
  }

  // 5) Footer
  const footerParts = [
    `🕒 Report period: ${startDate.toISOString().slice(0, 16).replace('T', ' ')} → ${endDate.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  ];
  if (baseUrl) footerParts.push(`<${baseUrl}|Open Dashboard>`);
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: footerParts.join('  ·  ') }],
  });

  if (blocks.length > 49) {
    const truncated = blocks.slice(0, 48);
    truncated.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_…truncated to fit Slack's 50-block limit_` }],
    });
    return { blocks: truncated };
  }
  return { blocks };
}

function trendRow(label, lastWeekVal, thisWeekVal) {
  if (lastWeekVal == null && thisWeekVal == null) return null;
  const lw = lastWeekVal != null ? Math.round(lastWeekVal) : '—';
  const tw = thisWeekVal != null ? Math.round(thisWeekVal) : '—';
  if (lw === '—' || tw === '—') return `${label}:  ${lw}  →  *${tw}*  — no comparison`;

  const delta = tw - lw;
  const verdict =
    delta === 0 ? '— no change' :
    delta > 0  ? `▲ *+${delta} points*  (better)` :
                 `▼ *${delta} points*  (worse)`;
  return `${label}:  ${lw}  →  *${tw}*  ${verdict}`;
}

function vitalTrendRow(label, lastWeekMs, thisWeekMs, unit, lowerIsBetter = true, decimals = 2) {
  if (lastWeekMs == null && thisWeekMs == null) return null;
  const fmt = (v) => {
    if (v == null) return '—';
    if (unit === 'ms' && v >= 1000) return `${(v / 1000).toFixed(2)}s`;
    if (unit === 'ms') return `${Math.round(v)}ms`;
    return v.toFixed(decimals);
  };
  const lw = fmt(lastWeekMs);
  const tw = fmt(thisWeekMs);
  if (lw === '—' || tw === '—') return `${label}:  ${lw}  →  *${tw}*`;

  const deltaRaw = (thisWeekMs ?? 0) - (lastWeekMs ?? 0);
  const isGood = lowerIsBetter ? deltaRaw < 0 : deltaRaw > 0;
  const magnitude = Math.abs(deltaRaw);
  const magStr = unit === 'ms' && magnitude >= 1000
    ? `${(magnitude / 1000).toFixed(2)}s`
    : unit === 'ms'
    ? `${Math.round(magnitude)}ms`
    : magnitude.toFixed(decimals);

  const verdict =
    deltaRaw === 0 ? '— unchanged' :
    isGood ? `▲ improved by ${magStr}` :
             `▼ slower by ${magStr}`;
  return `${label}:  ${lw}  →  *${tw}*  ${verdict}`;
}
