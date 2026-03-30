import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLatestResults, getUserTeams } from '@/lib/db';

// GET /api/results?teamId=xxx
// Returns latest scan results for all sites in a team
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    let teamId = searchParams.get('teamId');

    if (!teamId) {
      // Default to the user's first team
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ results: [] });
      }
      teamId = teams[0].id;
    }

    const results = await getLatestResults(cookieStore, teamId);
    return NextResponse.json({ results, teamId });
  } catch (error) {
    console.error('GET /api/results error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
