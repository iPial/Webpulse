import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIntegrations, createIntegration, getUserTeams, getUserRole } from '@/lib/db';

// GET /api/integrations?teamId=xxx
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    let teamId = searchParams.get('teamId');

    if (!teamId) {
      const teams = await getUserTeams(cookieStore);
      if (teams.length === 0) return NextResponse.json({ integrations: [] });
      teamId = teams[0].id;
    }

    const integrations = await getIntegrations(cookieStore, teamId);
    return NextResponse.json({ integrations, teamId });
  } catch (error) {
    console.error('GET /api/integrations error:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

// POST /api/integrations
// Body: { teamId, type, config, enabled? }
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const { teamId, type, config } = body;

    if (!teamId || !type || !config) {
      return NextResponse.json(
        { error: 'teamId, type, and config are required' },
        { status: 400 }
      );
    }

    const role = await getUserRole(cookieStore, teamId);
    if (!role || role === 'viewer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const integration = await createIntegration(cookieStore, {
      teamId,
      type,
      config,
      enabled: body.enabled,
    });

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    console.error('POST /api/integrations error:', error);
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 });
  }
}
