import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSites, createSite, getUserTeams, getUserRole } from '@/lib/db';

// GET /api/sites?teamId=xxx
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      // Return sites for the user's first team (convenience for single-team users)
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) {
        return NextResponse.json({ sites: [] });
      }
      const sites = await getSites(cookieStore, teams[0].id);
      return NextResponse.json({ sites, teamId: teams[0].id });
    }

    const sites = await getSites(cookieStore, teamId);
    return NextResponse.json({ sites, teamId });
  } catch (error) {
    console.error('GET /api/sites error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}

// POST /api/sites
// Body: { teamId, name, url, scanFrequency?, tags? }
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();

    const { teamId, name, url, scanFrequency, tags, logoUrl } = body;

    if (!teamId || !name || !url) {
      return NextResponse.json(
        { error: 'teamId, name, and url are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Check user has admin/owner role
    const role = await getUserRole(cookieStore, teamId);
    if (!role || role === 'viewer') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const site = await createSite(cookieStore, {
      teamId,
      name,
      url,
      scanFrequency,
      tags,
      logoUrl,
    });

    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    console.error('POST /api/sites error:', error);
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    );
  }
}
