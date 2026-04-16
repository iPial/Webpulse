import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { ensureTeam, getUserRole } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const team = await ensureTeam(cookieStore);
    const role = await getUserRole(cookieStore, team.id);

    return NextResponse.json({
      email: user.email,
      role: role || 'viewer',
      teamName: team.name,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 500 });
  }
}
