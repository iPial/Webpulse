import { resolveLogoUrl } from './logos';
import { computeDeltas, formatDelta } from './deltas';

const SMTP2GO_API_URL = 'https://api.smtp2go.com/v3/email/send';

// Send a PageSpeed report email via SMTP2GO
export async function sendReportEmail({ to, subject, html }) {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) throw new Error('SMTP2GO_API_KEY is not set. Add it in Vercel env vars.');

  const sender = process.env.SMTP2GO_SENDER || 'Webpulse <noreply@webpulse.app>';
  const recipients = Array.isArray(to) ? to : [to];

  const response = await fetch(SMTP2GO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Smtp2go-Api-Key': apiKey,
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: recipients,
      subject,
      html_body: html,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.data?.error) {
    const errMsg = data.data?.error || data.data?.failures?.join(', ') || `SMTP2GO error (${response.status})`;
    throw new Error(errMsg);
  }

  // Check for failed recipients
  const failures = data.data?.failures || [];
  if (failures.length > 0) {
    throw new Error(`Email delivery failed for: ${failures.join(', ')}`);
  }

  // Log succeeded count for debugging
  const succeeded = data.data?.succeeded || 0;
  if (succeeded === 0 && recipients.length > 0) {
    console.warn('SMTP2GO returned success but 0 emails succeeded. Check sender verification.');
    throw new Error('Email sent but not delivered. Check that your SMTP2GO sender address is verified.');
  }

  return data;
}

function scorePill(score) {
  if (score === null || score === undefined) {
    return '<span style="color: #6B7280;">—</span>';
  }
  const color = score >= 90 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const bg = score >= 90 ? '#064E3B' : score >= 50 ? '#78350F' : '#7F1D1D';
  return `<span style="display:inline-block; min-width:34px; text-align:center; padding:4px 8px; border-radius:999px; background:${bg}; color:${color}; font-weight:700; font-size:13px;">${score}</span>`;
}

function deltaPill(delta) {
  if (delta === null || delta === undefined || delta === 0) {
    return `<span style="display:block; color:#6B7280; font-size:10px; margin-top:4px;">—</span>`;
  }
  const positive = delta > 0;
  const color = positive ? '#10B981' : '#EF4444';
  const sign = positive ? '+' : '';
  const arrow = positive ? '▲' : '▼';
  return `<span style="display:block; color:${color}; font-size:10px; margin-top:4px; font-weight:600;">${arrow} ${sign}${delta}</span>`;
}

function scoreLabel(label, score, delta) {
  return `
    <div style="display:inline-block; margin-right:14px; text-align:center; vertical-align:top;">
      <div style="color:#9CA3AF; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">${label}</div>
      ${scorePill(score)}
      ${deltaPill(delta)}
    </div>
  `;
}

function vitalCell(label, value) {
  if (!value) return '';
  return `
    <span style="display:inline-block; margin-right:16px; color:#D1D5DB; font-size:12px;">
      <span style="color:#6B7280; font-size:11px;">${label}</span>
      <span style="color:#F3F4F6; margin-left:4px; font-weight:500;">${escapeHTML(String(value))}</span>
    </span>
  `;
}

function auditSummary(audits) {
  if (!audits) return '';
  const critical = Array.isArray(audits.critical) ? audits.critical.length : 0;
  const improvement = Array.isArray(audits.improvement) ? audits.improvement.length : 0;
  const optional = Array.isArray(audits.optional) ? audits.optional.length : 0;

  const items = [];
  if (critical > 0) items.push(`<span style="color:#EF4444; font-weight:600;">🔴 ${critical} critical</span>`);
  if (improvement > 0) items.push(`<span style="color:#F59E0B; font-weight:600;">🟡 ${improvement} to improve</span>`);
  if (optional > 0) items.push(`<span style="color:#10B981;">🟢 ${optional} optional</span>`);
  if (items.length === 0) items.push('<span style="color:#10B981; font-weight:600;">✅ No issues to fix</span>');

  return `<div style="margin-top:10px; font-size:13px;">${items.join('  &nbsp; ')}</div>`;
}

function topIssues(audits, limit = 3) {
  if (!audits?.critical || audits.critical.length === 0) return '';
  const top = audits.critical.slice(0, limit);
  const rows = top.map(
    (a) =>
      `<li style="margin:4px 0; color:#FCA5A5; font-size:13px;">
        <strong style="color:#F9FAFB;">${escapeHTML(a.title || '')}</strong>
        ${a.displayValue ? `<span style="color:#9CA3AF; font-size:12px; margin-left:4px;">— ${escapeHTML(a.displayValue)}</span>` : ''}
      </li>`
  ).join('');

  const more = audits.critical.length > limit ? `<li style="margin-top:4px; color:#9CA3AF; font-size:12px; list-style:none;">+${audits.critical.length - limit} more critical issue${audits.critical.length - limit !== 1 ? 's' : ''}</li>` : '';

  return `
    <div style="margin-top:12px; padding:10px 12px; background:#1F2937; border-left:3px solid #EF4444; border-radius:4px;">
      <div style="color:#EF4444; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Top critical issues</div>
      <ul style="margin:0; padding-left:18px;">${rows}${more}</ul>
    </div>
  `;
}

function aiFixes(aiSummary, siteId, baseUrl) {
  if (!aiSummary) return '';
  const summary = aiSummary.summary
    ? `<div style="color:#E5E7EB; font-style:italic; margin-bottom:8px; font-size:13px;">${escapeHTML(aiSummary.summary)}</div>`
    : '';

  const allFixes = aiSummary.topFixes || [];
  const top = allFixes.slice(0, 5);
  const overflow = allFixes.length - top.length;

  const fixes = top.map((f) => {
    const impact = f.impact
      ? `<span style="display:inline-block; margin-left:6px; padding:1px 6px; border-radius:999px; background:${impactBg(f.impact)}; color:${impactFg(f.impact)}; font-size:10px; font-weight:600;">${f.impact}</span>`
      : '';
    const rocketPath = f.rocketPath
      ? `<div style="margin-top:2px; color:#93C5FD; font-size:11px; font-family:monospace;">${escapeHTML(f.rocketPath)}</div>`
      : '';
    return `
      <li style="margin:8px 0; color:#E5E7EB; font-size:13px;">
        <div><strong style="color:#F9FAFB;">${escapeHTML(f.title)}</strong>${impact}</div>
        ${rocketPath}
        <div style="color:#C4B5FD; margin-top:2px;">${escapeHTML(f.action)}</div>
      </li>`;
  }).join('');

  const moreLink = overflow > 0 && baseUrl
    ? `<div style="margin-top:8px; font-size:12px;"><a href="${baseUrl}/site/${siteId}" style="color:#93C5FD; text-decoration:none;">+${overflow} more fix${overflow !== 1 ? 'es' : ''} in dashboard →</a></div>`
    : overflow > 0
      ? `<div style="margin-top:8px; color:#9CA3AF; font-size:12px;">+${overflow} more fix${overflow !== 1 ? 'es' : ''} in dashboard</div>`
      : '';

  if (!summary && !fixes) return '';
  return `
    <div style="margin-top:14px; padding:12px 14px; background:#1F1630; border-left:3px solid #A855F7; border-radius:4px;">
      <div style="color:#C4B5FD; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">🤖 AI — Top Fixes</div>
      ${summary}
      <ul style="margin:0; padding-left:18px;">${fixes}</ul>
      ${moreLink}
    </div>
  `;
}

function impactBg(impact) {
  if (impact === 'High') return '#7F1D1D';
  if (impact === 'Medium') return '#78350F';
  return '#374151';
}
function impactFg(impact) {
  if (impact === 'High') return '#FCA5A5';
  if (impact === 'Medium') return '#FCD34D';
  return '#D1D5DB';
}

function siteCard({ site, mobile, desktop, previous = {} }, baseUrl, aiSummary) {
  const reportUrl = baseUrl ? `${baseUrl}/site/${site.id}` : null;
  const logoUrl = resolveLogoUrl(site, 64);

  const mobileDeltas = computeDeltas(mobile, previous?.mobile);
  const desktopDeltas = computeDeltas(desktop, previous?.desktop);

  return `
    <div style="background:#1F2937; border:1px solid #374151; border-radius:12px; padding:20px; margin-bottom:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
        <tr>
          ${
            logoUrl
              ? `<td width="56" valign="top" style="padding-right:12px;"><img src="${logoUrl}" alt="" width="44" height="44" style="display:block; border-radius:8px; background:#111827; border:1px solid #374151; padding:4px; object-fit:contain;" /></td>`
              : ''
          }
          <td valign="top">
            <div style="color:#F9FAFB; font-size:16px; font-weight:700;">${escapeHTML(site.name)}</div>
            <div style="color:#9CA3AF; font-size:12px; margin-top:2px; word-break:break-all;">${escapeHTML(site.url)}</div>
          </td>
        </tr>
      </table>

      ${
        mobile
          ? `
        <div style="padding:12px 0; border-top:1px solid #374151;">
          <div style="color:#9CA3AF; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">📱 Mobile</div>
          <div style="margin-bottom:10px;">
            ${scoreLabel('Perf', mobile.performance, mobileDeltas?.performance)}
            ${scoreLabel('A11y', mobile.accessibility, mobileDeltas?.accessibility)}
            ${scoreLabel('BP', mobile.best_practices, mobileDeltas?.bestPractices)}
            ${scoreLabel('SEO', mobile.seo, mobileDeltas?.seo)}
          </div>
          <div style="margin-top:8px;">
            ${vitalCell('LCP', mobile.lcp)}
            ${vitalCell('FCP', mobile.fcp)}
            ${vitalCell('TBT', mobile.tbt)}
            ${vitalCell('CLS', mobile.cls)}
          </div>
          ${auditSummary(mobile.audits)}
          ${topIssues(mobile.audits)}
        </div>
      `
          : ''
      }

      ${
        desktop
          ? `
        <div style="padding:12px 0; border-top:1px solid #374151;">
          <div style="color:#9CA3AF; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">🖥️ Desktop</div>
          <div style="margin-bottom:10px;">
            ${scoreLabel('Perf', desktop.performance, desktopDeltas?.performance)}
            ${scoreLabel('A11y', desktop.accessibility, desktopDeltas?.accessibility)}
            ${scoreLabel('BP', desktop.best_practices, desktopDeltas?.bestPractices)}
            ${scoreLabel('SEO', desktop.seo, desktopDeltas?.seo)}
          </div>
          <div>
            ${vitalCell('LCP', desktop.lcp)}
            ${vitalCell('FCP', desktop.fcp)}
            ${vitalCell('TBT', desktop.tbt)}
            ${vitalCell('CLS', desktop.cls)}
          </div>
        </div>
      `
          : ''
      }

      ${aiFixes(aiSummary, site.id, baseUrl)}

      ${
        reportUrl
          ? `
        <div style="margin-top:14px; padding-top:14px; border-top:1px solid #374151; text-align:right;">
          <a href="${reportUrl}" style="display:inline-block; padding:8px 16px; background:#2563EB; color:#fff; text-decoration:none; border-radius:8px; font-size:13px; font-weight:600;">View full report →</a>
        </div>
      `
          : ''
      }
    </div>
  `;
}

// Build HTML email for a scan report.
// aiSummariesBySiteId: optional { [siteId]: { summary, topFixes } }
export function buildReportHTML(sites, { baseUrl = '', aiSummariesBySiteId = null } = {}) {
  // Count criticals across sites
  let totalCritical = 0;
  for (const { mobile, desktop } of sites) {
    const r = mobile || desktop;
    if (r?.audits?.critical) totalCritical += r.audits.critical.length;
  }

  const dashboardButton = baseUrl
    ? `
      <div style="text-align:center; margin:16px 0 24px 0;">
        <a href="${baseUrl}" style="display:inline-block; padding:12px 28px; background:#2563EB; color:#fff; text-decoration:none; border-radius:10px; font-size:14px; font-weight:600;">📊 Open Dashboard →</a>
      </div>
    `
    : '';

  const dashboardLink = baseUrl
    ? `<a href="${baseUrl}" style="color:#60A5FA; text-decoration:none;">Open Dashboard →</a>`
    : '';

  const cards = sites
    .map((s) => siteCard(s, baseUrl, aiSummariesBySiteId?.[s.site.id] || null))
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0B1120; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 720px; margin: 0 auto; padding: 32px 16px;">
        <div style="margin-bottom: 8px;">
          <h1 style="color: #F9FAFB; font-size: 22px; margin: 0 0 6px 0;">📊 Webpulse Scan Report</h1>
          <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
            <strong style="color:#F3F4F6;">${sites.length}</strong> site${sites.length !== 1 ? 's' : ''} scanned
            &nbsp;·&nbsp;
            ${
              totalCritical > 0
                ? `<span style="color: #EF4444; font-weight:600;">🔴 ${totalCritical} critical issue${totalCritical !== 1 ? 's' : ''}</span>`
                : '<span style="color: #10B981; font-weight:600;">✅ No critical issues</span>'
            }
            ${aiSummariesBySiteId ? '&nbsp;·&nbsp;<span style="color:#C4B5FD; font-weight:600;">🤖 AI analysis included</span>' : ''}
          </p>
        </div>

        ${dashboardButton}

        ${cards}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #374151; text-align:center;">
          <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px 0;">
            Sent by Webpulse &middot; ${new Date().toISOString().slice(0, 10)}
          </p>
          ${dashboardLink ? `<p style="margin:0;">${dashboardLink}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================
// Trend Report HTML — used by scheduled weekly/monthly report runs
// ============================================

// trendBySiteId is the same shape produced by db.getTrendData /
// getTrendDataForTeam: { [siteId]: { site, thisWindow, lastWindow,
// bestDay, worstDay } }.
//
// windowDays: 7 → "Weekly", 30 → "Monthly", anything else → custom label.
export function buildTrendEmailHTML(trendBySiteId, { baseUrl = '', windowDays = 7, periodStart, periodEnd } = {}) {
  const sites = Object.values(trendBySiteId || {});
  const now = Date.now();
  const startDate = periodStart ? new Date(periodStart) : new Date(now - windowDays * 86400000);
  const endDate = periodEnd ? new Date(periodEnd) : new Date(now);

  const cadenceLabel =
    windowDays === 30 ? 'Monthly Report'
    : windowDays === 7 ? 'Weekly Report'
    : `${windowDays}-Day Trend`;

  const dateRange =
    `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ` +
    `${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const totalScans = sites.reduce((acc, s) => acc + (s.thisWindow?.scanCount || s.thisWeek?.scanCount || 0), 0);

  const dashboardButton = baseUrl
    ? `
      <div style="margin: 16px 0 24px 0;">
        <a href="${baseUrl}/history" style="display:inline-block; background-color:#3B82F6; color:white; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Open History →</a>
      </div>
    `
    : '';

  const cards = sites.map((entry) => trendSiteCard(entry, baseUrl)).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0B1120; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 720px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="color: #F9FAFB; font-size: 22px; margin: 0 0 6px 0;">📈 Webpulse ${cadenceLabel}</h1>
        <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
          ${escapeHTML(dateRange)} &nbsp;·&nbsp; <strong style="color:#F3F4F6;">${sites.length}</strong> site${sites.length !== 1 ? 's' : ''}
          ${totalScans > 0 ? `&nbsp;·&nbsp; <strong style="color:#F3F4F6;">${totalScans}</strong> scans` : ''}
        </p>

        ${dashboardButton}
        ${cards}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #374151; text-align:center;">
          <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px 0;">
            Sent by Webpulse &middot; ${new Date().toISOString().slice(0, 10)}
          </p>
          ${baseUrl ? `<p style="margin:0;"><a href="${baseUrl}" style="color:#60A5FA; text-decoration:none;">Open Dashboard →</a></p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

function trendSiteCard(entry, baseUrl) {
  if (!entry?.site) return '';
  const tw = entry.thisWindow || entry.thisWeek || {};
  const lw = entry.lastWindow || entry.lastWeek || {};

  const logoUrl = resolveLogoUrl(entry.site, 48);
  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="" width="32" height="32" style="border-radius:8px; vertical-align:middle; margin-right:10px;" />`
    : '';

  return `
    <div style="background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <div style="margin-bottom: 12px;">
        ${logoImg}
        <span style="color: #F9FAFB; font-size: 16px; font-weight: 600; vertical-align: middle;">${escapeHTML(entry.site.name)}</span>
      </div>

      <table style="width:100%; border-collapse:collapse; color:#E5E7EB; font-size: 13px; margin-bottom: 8px;">
        <thead>
          <tr style="color:#9CA3AF; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">
            <th style="padding:6px 8px 6px 0; font-weight:600;">Metric</th>
            <th style="padding:6px 8px; font-weight:600;">Last</th>
            <th style="padding:6px 8px; font-weight:600;">Now</th>
            <th style="padding:6px 8px; font-weight:600;">Δ</th>
          </tr>
        </thead>
        <tbody>
          ${trendRow('Mobile Performance', lw.avgPerf, tw.avgPerf)}
          ${trendRow('Desktop Performance', lw.avgDesktopPerf, tw.avgDesktopPerf)}
          ${trendRow('Accessibility', lw.avgA11y, tw.avgA11y)}
          ${trendRow('SEO', lw.avgSEO, tw.avgSEO)}
          ${vitalRow('LCP', lw.avgLcpMs, tw.avgLcpMs, 'ms', true)}
          ${vitalRow('TBT', lw.avgTbtMs, tw.avgTbtMs, 'ms', true)}
          ${vitalRow('CLS', lw.avgCls, tw.avgCls, '', true, 3)}
        </tbody>
      </table>

      ${
        tw.criticalCount != null && lw.criticalCount != null
          ? `<p style="color:#9CA3AF; font-size:12px; margin: 8px 0 0 0;">
              <strong style="color:#F3F4F6;">Critical issues:</strong> ${lw.criticalCount} → <strong style="color:#F3F4F6;">${tw.criticalCount}</strong>
              ${
                tw.criticalCount > lw.criticalCount
                  ? ` <span style="color:#EF4444;">(+${tw.criticalCount - lw.criticalCount} new)</span>`
                  : tw.criticalCount < lw.criticalCount
                  ? ` <span style="color:#10B981;">(${tw.criticalCount - lw.criticalCount} resolved)</span>`
                  : ''
              }
            </p>`
          : ''
      }

      ${
        baseUrl
          ? `<div style="margin-top: 12px;">
              <a href="${baseUrl}/history?siteId=${entry.site.id}" style="color:#60A5FA; font-size:12px; text-decoration:none;">View history →</a>
            </div>`
          : ''
      }
    </div>
  `;
}

function trendRow(label, lastVal, thisVal) {
  if (lastVal == null && thisVal == null) return '';
  const lw = lastVal != null ? Math.round(lastVal) : '—';
  const tw = thisVal != null ? Math.round(thisVal) : '—';
  const delta = lastVal != null && thisVal != null ? Math.round(thisVal) - Math.round(lastVal) : null;
  const deltaCell =
    delta === null
      ? '—'
      : delta === 0
      ? '<span style="color:#6B7280;">—</span>'
      : delta > 0
      ? `<span style="color:#10B981; font-weight:600;">▲ +${delta}</span>`
      : `<span style="color:#EF4444; font-weight:600;">▼ ${delta}</span>`;
  return `
    <tr>
      <td style="padding:5px 8px 5px 0;">${escapeHTML(label)}</td>
      <td style="padding:5px 8px; color:#9CA3AF;">${lw}</td>
      <td style="padding:5px 8px; font-weight:600;">${tw}</td>
      <td style="padding:5px 8px;">${deltaCell}</td>
    </tr>
  `;
}

function vitalRow(label, lastMs, thisMs, unit, lowerIsBetter = true, decimals = 2) {
  if (lastMs == null && thisMs == null) return '';
  const fmt = (v) => {
    if (v == null) return '—';
    if (unit === 'ms' && v >= 1000) return `${(v / 1000).toFixed(2)}s`;
    if (unit === 'ms') return `${Math.round(v)}ms`;
    return v.toFixed(decimals);
  };
  const lw = fmt(lastMs);
  const tw = fmt(thisMs);
  const deltaRaw = lastMs != null && thisMs != null ? thisMs - lastMs : null;
  let deltaCell = '—';
  if (deltaRaw !== null && deltaRaw !== 0) {
    const isGood = lowerIsBetter ? deltaRaw < 0 : deltaRaw > 0;
    const color = isGood ? '#10B981' : '#EF4444';
    const arrow = isGood ? '▲' : '▼';
    const magnitude = Math.abs(deltaRaw);
    const magStr =
      unit === 'ms' && magnitude >= 1000
        ? `${(magnitude / 1000).toFixed(2)}s`
        : unit === 'ms'
        ? `${Math.round(magnitude)}ms`
        : magnitude.toFixed(decimals);
    deltaCell = `<span style="color:${color}; font-weight:600;">${arrow} ${magStr}</span>`;
  } else if (deltaRaw === 0) {
    deltaCell = '<span style="color:#6B7280;">—</span>';
  }

  return `
    <tr>
      <td style="padding:5px 8px 5px 0;">${escapeHTML(label)}</td>
      <td style="padding:5px 8px; color:#9CA3AF;">${lw}</td>
      <td style="padding:5px 8px; font-weight:600;">${tw}</td>
      <td style="padding:5px 8px;">${deltaCell}</td>
    </tr>
  `;
}
