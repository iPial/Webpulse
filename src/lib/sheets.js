// Google Sheets export via Sheets API v4
// Requires a service account or API key with Sheets write access
// For Phase 1, uses a simple append-based approach via the Sheets API

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Append scan results as rows to a Google Sheet
export async function appendToSheet(spreadsheetId, rows) {
  const apiKey = process.env.GOOGLE_PSI_API_KEY; // Reuse the same Google API key
  if (!apiKey) throw new Error('GOOGLE_PSI_API_KEY is not set');
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID is not set');

  const url = `${SHEETS_API_URL}/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${body}`);
  }

  return response.json();
}

// Build rows from scan results for the spreadsheet
// Header: Date | Site | Strategy | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Critical | Improvements
export function buildSheetRows(sites) {
  const date = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const { site, mobile, desktop } of sites) {
    if (mobile) {
      rows.push(buildRow(date, site, 'mobile', mobile));
    }
    if (desktop) {
      rows.push(buildRow(date, site, 'desktop', desktop));
    }
  }

  return rows;
}

function buildRow(date, site, strategy, result) {
  const audits = result.audits || {};
  return [
    date,
    site.name,
    strategy,
    result.performance ?? '',
    result.accessibility ?? '',
    result.best_practices ?? '',
    result.seo ?? '',
    result.fcp || '',
    result.lcp || '',
    result.tbt || '',
    result.cls || '',
    audits.critical?.length || 0,
    audits.improvement?.length || 0,
  ];
}

// Create header row if the sheet is empty
export function getHeaderRow() {
  return [
    'Date',
    'Site',
    'Strategy',
    'Performance',
    'Accessibility',
    'Best Practices',
    'SEO',
    'FCP',
    'LCP',
    'TBT',
    'CLS',
    'Critical Issues',
    'Improvements',
  ];
}

// Check if sheet has headers, and add them if not
export async function ensureHeaders(spreadsheetId) {
  const apiKey = process.env.GOOGLE_PSI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PSI_API_KEY is not set');

  // Read first row
  const url = `${SHEETS_API_URL}/${spreadsheetId}/values/Sheet1!A1:M1?key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    // Sheet might be empty or not exist — try to write headers
    await appendToSheet(spreadsheetId, [getHeaderRow()]);
    return;
  }

  const data = await response.json();
  if (!data.values || data.values.length === 0 || data.values[0][0] !== 'Date') {
    await appendToSheet(spreadsheetId, [getHeaderRow()]);
  }
}
