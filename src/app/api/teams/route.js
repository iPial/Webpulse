import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTeam } from '@/lib/db';

// POST /api/teams
// Body: { name }
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);

    const team = await createTeam(cookieStore, { name, slug });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('POST /api/teams error:', error);

    if (error.code === '23505') {
      return NextResponse.json({ error: 'A team with that name already exists' }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to create team', details: error.message },
      { status: 500 }
    );
  }
}
