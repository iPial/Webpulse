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

// Build HTML email for a scan report
export function buildReportHTML(sites) {
  const rows = sites.map(({ site, mobile, desktop }) => {
    const result = mobile || desktop;
    if (!result) return '';

    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #374151;">
          <strong style="color: #F9FAFB;">${escapeHTML(site.name)}</strong>
          <br><span style="color: #9CA3AF; font-size: 12px;">${escapeHTML(site.url)}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #374151; text-align: center;">
          ${scoreCell(result.performance)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #374151; text-align: center;">
          ${scoreCell(result.accessibility)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #374151; text-align: center;">
          ${scoreCell(result.best_practices)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #374151; text-align: center;">
          ${scoreCell(result.seo)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #374151; text-align: center; color: #9CA3AF; font-size: 12px;">
          ${result.lcp || '—'}
        </td>
      </tr>
    `;
  }).join('');

  // Count critical issues
  let totalCritical = 0;
  for (const { mobile, desktop } of sites) {
    const result = mobile || desktop;
    if (result?.audits?.critical) {
      totalCritical += result.audits.critical.length;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #111827; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 700px; margin: 0 auto; padding: 32px 16px;">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #F9FAFB; font-size: 20px; margin: 0 0 4px 0;">Webpulse Daily Report</h1>
          <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
            ${sites.length} site${sites.length !== 1 ? 's' : ''} scanned &middot;
            ${totalCritical > 0 ? `<span style="color: #EF4444;">${totalCritical} critical issue${totalCritical !== 1 ? 's' : ''}</span>` : '<span style="color: #10B981;">No critical issues</span>'}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; background-color: #1F2937; border-radius: 12px; overflow: hidden;">
          <thead>
            <tr style="border-bottom: 1px solid #374151;">
              <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #9CA3AF; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Site</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 500;">Perf</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 500;">A11y</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 500;">BP</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 500;">SEO</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; color: #9CA3AF; font-weight: 500;">LCP</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #374151;">
          <p style="color: #6B7280; font-size: 12px; margin: 0;">
            Sent by Webpulse &middot; ${new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function scoreCell(score) {
  if (score === null || score === undefined) return '<span style="color: #6B7280;">—</span>';

  const color = score >= 90 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return `<span style="color: ${color}; font-weight: 600; font-size: 14px;">${score}</span>`;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
