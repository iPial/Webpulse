import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserTeams, getLatestResults } from '@/lib/db';
import { appendToSheet, buildSheetRows, ensureHeaders } from '@/lib/sheets';

// POST /api/export/sheets
// Body: { teamId?, spreadsheetId? }
// Exports latest scan results to a Google Sheet
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();

    // Determine spreadsheet ID
    const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No spreadsheet ID configured. Set GOOGLE_SHEETS_ID or provide spreadsheetId.' },
        { status: 400 }
      );
    }

    // Determine team
    let teamId = body.teamId;
    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 });
      }
      teamId = teams[0].id;
    }

    // Fetch latest results
    const results = await getLatestResults(cookieStore, teamId);

    if (results.length === 0) {
      return NextResponse.json({ error: 'No scan results to export' }, { status: 404 });
    }

    // Group by site
    const siteMap = new Map();
    for (const row of results) {
      if (!siteMap.has(row.site_id)) {
        siteMap.set(row.site_id, { site: row.sites, mobile: null, desktop: null });
      }
      siteMap.get(row.site_id)[row.strategy] = row;
    }
    const sites = Array.from(siteMap.values());

    // Ensure headers exist in the sheet
    await ensureHeaders(spreadsheetId);

    // Build and append rows
    const rows = buildSheetRows(sites);
    const result = await appendToSheet(spreadsheetId, rows);

    return NextResponse.json({
      success: true,
      rowsAppended: rows.length,
      updatedRange: result.updates?.updatedRange,
    });
  } catch (error) {
    console.error('Sheets export error:', error);
    return NextResponse.json(
      { error: 'Failed to export to Google Sheets', details: error.message },
      { status: 500 }
    );
  }
}
