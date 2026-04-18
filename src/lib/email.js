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

function scoreLabel(label, score) {
  return `
    <div style="display:inline-block; margin-right:14px;">
      <div style="color:#9CA3AF; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">${label}</div>
      ${scorePill(score)}
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

function siteCard({ site, mobile, desktop }, baseUrl) {
  const reportUrl = baseUrl ? `${baseUrl}/site/${site.id}` : null;
  const primary = mobile || desktop;

  return `
    <div style="background:#1F2937; border:1px solid #374151; border-radius:12px; padding:20px; margin-bottom:16px;">
      <div style="display:flex; align-items:start; justify-content:space-between; margin-bottom:16px;">
        <div>
          <div style="color:#F9FAFB; font-size:16px; font-weight:700;">${escapeHTML(site.name)}</div>
          <div style="color:#9CA3AF; font-size:12px; margin-top:2px; word-break:break-all;">${escapeHTML(site.url)}</div>
        </div>
      </div>

      ${
        mobile
          ? `
        <div style="padding:12px 0; border-top:1px solid #374151;">
          <div style="color:#9CA3AF; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">📱 Mobile</div>
          <div style="margin-bottom:10px;">
            ${scoreLabel('Perf', mobile.performance)}
            ${scoreLabel('A11y', mobile.accessibility)}
            ${scoreLabel('BP', mobile.best_practices)}
            ${scoreLabel('SEO', mobile.seo)}
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
            ${scoreLabel('Perf', desktop.performance)}
            ${scoreLabel('A11y', desktop.accessibility)}
            ${scoreLabel('BP', desktop.best_practices)}
            ${scoreLabel('SEO', desktop.seo)}
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

// Build HTML email for a scan report
export function buildReportHTML(sites, { baseUrl = '' } = {}) {
  // Count criticals across sites
  let totalCritical = 0;
  for (const { mobile, desktop } of sites) {
    const r = mobile || desktop;
    if (r?.audits?.critical) totalCritical += r.audits.critical.length;
  }

  const dashboardLink = baseUrl
    ? `<a href="${baseUrl}" style="color:#60A5FA; text-decoration:none;">Open Dashboard →</a>`
    : '';

  const cards = sites.map((s) => siteCard(s, baseUrl)).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0B1120; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 720px; margin: 0 auto; padding: 32px 16px;">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #F9FAFB; font-size: 22px; margin: 0 0 6px 0;">📊 Webpulse Scan Report</h1>
          <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
            <strong style="color:#F3F4F6;">${sites.length}</strong> site${sites.length !== 1 ? 's' : ''} scanned
            &nbsp;·&nbsp;
            ${
              totalCritical > 0
                ? `<span style="color: #EF4444; font-weight:600;">🔴 ${totalCritical} critical issue${totalCritical !== 1 ? 's' : ''}</span>`
                : '<span style="color: #10B981; font-weight:600;">✅ No critical issues</span>'
            }
          </p>
        </div>

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
